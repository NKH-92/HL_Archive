import { getDocumentCapacity, getDocumentQualitySummary } from "../domains/documents/index.js";
import { getAppUsers } from "../domains/identity/index.js";
import { getSearchProjectionState } from "../domains/search/index.js";
import { hasReadPermission, PERMISSIONS } from "../permissions.js";

const EXPECTED_CORE_MIGRATION = "0048_core_search_projection.sql";

export async function loadAdminDashboardReadModel(env, session) {
  const canViewAudit = hasReadPermission(session, PERMISSIONS.VIEW_AUDIT);
  const [users, quality, capacity, readiness] = await Promise.all([
    hasReadPermission(session, PERMISSIONS.MANAGE_USERS) ? getAppUsers(env) : Promise.resolve([]),
    hasReadPermission(session, PERMISSIONS.MANAGE_DOCUMENTS) ? getDocumentQualitySummary(env) : Promise.resolve(null),
    hasReadPermission(session, PERMISSIONS.MANAGE_DOCUMENTS) ? getDocumentCapacity(env) : Promise.resolve(null),
    canViewAudit ? loadOperationalReadinessReadModel(env) : Promise.resolve(null)
  ]);

  const result = {
    pendingCount: users.filter((user) => user.status === "pending").length,
    quality,
    searchIndex: readiness
      ? {
          ...readiness.projection,
          readiness,
          // 검색 상태는 이미 조회한 projection read model만 재사용하며 별도 문서 전체 집계를 만들지 않는다.
          level: readiness.ok && !readiness.degraded ? "ok" : "warning"
        }
      : null
  };
  if (capacity) result.capacity = capacity;
  if (readiness) result.readiness = readiness;
  return Object.freeze(result);
}

/**
 * 배포 준비 판정.
 *
 * 필수 조건은 Core D1 schema 도달성뿐이다. 검색 색인은 재구축 가능한 파생 데이터이므로
 * 동기화 지연을 readiness 실패로 올리지 않는다. 파생 색인의 지연을 배포 게이트로 쓰면
 * 파생 데이터 지연이 곧 서비스 중단 판정이 되어 격리 원칙과 반대로 작동한다.
 * 재색인 지연과 dirty 잔량은 warnings로 노출하고 관리자 화면에서 확인한다.
 */
export async function loadOperationalReadinessReadModel(env) {
  const [coreMigration, projection] = await Promise.all([
    readLatestMigration(env.DB),
    readProjectionReadiness(env)
  ]);
  const checks = Object.freeze({
    coreDatabase: migrationAtLeast(coreMigration, EXPECTED_CORE_MIGRATION)
  });
  const warnings = Object.freeze({
    searchProjectionSynced: projection.ready
  });
  const migrations = Object.freeze({
    core: Object.freeze({ current: coreMigration, expected: EXPECTED_CORE_MIGRATION, ready: checks.coreDatabase })
  });
  return Object.freeze({
    ok: Object.values(checks).every(Boolean),
    degraded: !Object.values(warnings).every(Boolean),
    checks,
    warnings,
    migrations,
    projection: projection.details
  });
}

async function readProjectionReadiness(env) {
  try {
    const state = await getSearchProjectionState(env);
    return {
      ready: state.ready && state.pendingDirtyCount === 0,
      details: Object.freeze({
        available: state.available,
        reindexStatus: state.reindexStatus,
        indexedDocumentCount: state.indexedDocumentCount,
        pendingDirtyCount: state.pendingDirtyCount,
        lastReindexedAt: state.lastReindexedAt
      })
    };
  } catch {
    return {
      ready: false,
      details: Object.freeze({
        available: false,
        reindexStatus: "unavailable",
        indexedDocumentCount: 0,
        pendingDirtyCount: 0,
        lastReindexedAt: null
      })
    };
  }
}

async function readLatestMigration(database) {
  if (!database || typeof database.prepare !== "function") {
    throw new TypeError("D1 database binding이 필요합니다.");
  }
  const row = await database.prepare(`
    SELECT name
    FROM d1_migrations
    ORDER BY id DESC
    LIMIT 1
  `).first();
  return String(row?.name || "");
}

function migrationAtLeast(current, expected) {
  const currentSequence = migrationSequence(current);
  const expectedSequence = migrationSequence(expected);
  return expectedSequence >= 0 && currentSequence >= expectedSequence;
}

function migrationSequence(name) {
  const match = /^(\d{4})_/.exec(String(name || ""));
  return match ? Number(match[1]) : -1;
}
