import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

import { loadDocumentFormOptions } from "../src/domains/documents/index.js";
import {
  applyDocumentSnapshot,
  createDocumentSnapshot,
  EXCEL_SNAPSHOT_SCHEMA_VERSION,
  prepareDocumentSnapshot,
  runScheduledBootstrapApplication,
  stageDocumentSnapshotRows
} from "../src/domains/snapshots/index.js";
import { FREE_TIER_BUDGET } from "../src/freeTierBudget.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const migrationsDir = path.join(root, "migrations");
const count = parseCount(process.argv.slice(2));
const actor = Object.freeze({
  userId: 1,
  username: "initial-load-rehearsal",
  displayName: "초기 적재 리허설",
  role: "Admin"
});

const database = new DatabaseSync(":memory:");
database.exec("PRAGMA foreign_keys = ON;");

try {
  const startedAt = performance.now();
  await applyAllMigrations(database);
  const migrationMs = performance.now() - startedAt;
  const env = {
    DB: sqliteD1(database),
    EXCEL_SNAPSHOT_APPLY_MODE: "permissioned"
  };
  const rows = buildRows(count);

  const createStartedAt = performance.now();
  const created = await createDocumentSnapshot(env, {
    sourceName: `initial-load-${count}.xlsx`,
    sourceHash: "a".repeat(64),
    sourceSize: Math.min(FREE_TIER_BUDGET.excelSnapshotMaxFileBytes, Math.max(4096, count * 256)),
    totalCount: count,
    schemaVersion: EXCEL_SNAPSHOT_SCHEMA_VERSION,
    mode: "bootstrap",
    hasRowKeys: false,
    syncReason: `${count.toLocaleString("ko-KR")}건 실사용 전 초기 적재 리허설`,
    bootstrapConfirmation: "BOOTSTRAP",
    backupConfirmed: true
  }, actor);
  assertOk(created, "snapshot 생성");

  let stagedChunks = 0;
  for (let index = 0; index < rows.length; index += FREE_TIER_BUDGET.excelSnapshotStageChunkSize) {
    const staged = await stageDocumentSnapshotRows(
      env,
      created.id,
      rows.slice(index, index + FREE_TIER_BUDGET.excelSnapshotStageChunkSize)
    );
    assertOk(staged, `staging ${index + 1}~${Math.min(index + FREE_TIER_BUDGET.excelSnapshotStageChunkSize, rows.length)}행`);
    stagedChunks += 1;
  }
  const stageMs = performance.now() - createStartedAt;

  const prepareStartedAt = performance.now();
  const formOptions = await loadDocumentFormOptions(env, { activeOnly: true });
  const prepared = await prepareDocumentSnapshot(env, created.id, formOptions, null, actor);
  assertOk(prepared, "snapshot prepare");
  if (Number(prepared.snapshot?.create_count || 0) !== count) {
    throw new Error(`prepare create_count가 ${count}건이 아닙니다: ${prepared.snapshot?.create_count}`);
  }
  const prepareMs = performance.now() - prepareStartedAt;

  const applyStartedAt = performance.now();
  const applied = await applyDocumentSnapshot(env, created.id, actor, {
    applyReason: `${count.toLocaleString("ko-KR")}건 초기 적재 리허설 반영`,
    approvalReference: `REHEARSAL-${count}`,
    confirmedExcludeCount: 0,
    confirmExclude: true,
    confirmReview: true,
    confirmedReviewCount: count
  });
  assertOk(applied, "snapshot apply");
  let automaticApplyChunks = 0;
  if (applied.scheduled) {
    const maximumChunks = Math.ceil(count / FREE_TIER_BUDGET.bootstrapApplyChunkSize) + 1;
    while (automaticApplyChunks < maximumChunks) {
      const chunk = await runScheduledBootstrapApplication(env, { force: true });
      assertOk(chunk, `자동 분할 반영 ${automaticApplyChunks + 1}`);
      if (!chunk.processed) throw new Error("예약된 최초 적재 chunk를 선점하지 못했습니다.");
      automaticApplyChunks += 1;
      if (chunk.completed) break;
    }
  }
  const applyMs = performance.now() - applyStartedAt;

  const currentDocuments = scalar(database, "SELECT COUNT(*) FROM documents WHERE sync_state = 'current'");
  const disposedDocuments = scalar(database, "SELECT COUNT(*) FROM documents WHERE sync_state = 'current' AND status = 'disposed'");
  const documentTags = scalar(database, "SELECT COUNT(*) FROM document_tags");
  const snapshotRows = scalar(database, "SELECT COUNT(*) FROM document_snapshot_rows WHERE snapshot_id = ?", created.id);
  const membershipRows = scalar(database, "SELECT COUNT(*) FROM document_snapshot_membership WHERE snapshot_id = ?", created.id);
  const syntheticCreateAudits = scalar(database, "SELECT COUNT(*) FROM document_audit_logs WHERE action = 'excel_sync_create'");
  const initialDisposalLogs = scalar(database, "SELECT COUNT(*) FROM disposal_logs WHERE snapshot_code = ?", prepared.snapshot.snapshot_code);
  const projection = database.prepare(`
    SELECT generation, reindex_status, reindex_cursor, indexed_document_count
    FROM search_projection_state
    WHERE id = 1
  `).get();
  const dirtyCount = scalar(database, "SELECT COUNT(*) FROM search_projection_dirty");
  const sample = database.prepare("SELECT rack_slot_id, rack_face FROM documents WHERE document_number = 'DOC-05000'").get()
    || database.prepare("SELECT rack_slot_id, rack_face FROM documents ORDER BY id LIMIT 1").get();
  const queryTimingsMs = {
    browse: measuredQuery(database, "SELECT id FROM documents WHERE sync_state = 'current' AND status = 'active' ORDER BY updated_at DESC, id DESC LIMIT 30"),
    exactNumber: measuredQuery(database, "SELECT id FROM documents WHERE sync_state = 'current' AND UPPER(document_number) = UPPER(?) LIMIT 30", "DOC-05000"),
    exactName: measuredQuery(database, "SELECT id FROM documents WHERE sync_state = 'current' AND document_name = ? COLLATE NOCASE ORDER BY id DESC LIMIT 30", "문서고 실사용 리허설 문서 5000"),
    location: measuredQuery(database, "SELECT id FROM documents WHERE sync_state = 'current' AND rack_slot_id = ? AND rack_face = ? LIMIT 30", Number(sample?.rack_slot_id || 0), String(sample?.rack_face || "A"))
  };

  if (currentDocuments !== count) throw new Error(`current 문서 수 불일치: ${currentDocuments}/${count}`);
  if (snapshotRows !== count) throw new Error(`snapshot staging 수 불일치: ${snapshotRows}/${count}`);
  if (membershipRows !== 0) throw new Error(`bootstrap membership은 0이어야 합니다: ${membershipRows}`);
  if (syntheticCreateAudits !== 0) throw new Error(`bootstrap 가상 create audit이 남았습니다: ${syntheticCreateAudits}`);
  if (initialDisposalLogs !== 0) throw new Error(`bootstrap 가상 disposal log가 남았습니다: ${initialDisposalLogs}`);
  if (projection?.reindex_status !== "pending") throw new Error(`projection이 pending이 아닙니다: ${projection?.reindex_status}`);
  if (dirtyCount !== 0) throw new Error(`bootstrap 직후 dirty 큐는 비어야 합니다: ${dirtyCount}`);

  const totalMs = performance.now() - startedAt;
  const result = {
    ok: true,
    documentsRequested: count,
    migrationCount: (await migrationFiles()).length,
    stageChunkSize: FREE_TIER_BUDGET.excelSnapshotStageChunkSize,
    stagedChunks,
    prepareStatements: Number(prepared.statementCount || 0),
    applyStatements: Number(applied.statementCount || 0),
    automaticApplyChunkSize: FREE_TIER_BUDGET.bootstrapApplyChunkSize,
    automaticApplyChunks,
    currentDocuments,
    disposedDocuments,
    documentTags,
    snapshotRows,
    membershipRows,
    syntheticCreateAudits,
    initialDisposalLogs,
    projection: {
      generation: Number(projection?.generation || 0),
      status: projection?.reindex_status,
      cursor: Number(projection?.reindex_cursor || 0),
      indexedDocuments: Number(projection?.indexed_document_count || 0),
      dirtyCount
    },
    timingsMs: {
      migrations: round(migrationMs),
      stage: round(stageMs),
      prepare: round(prepareMs),
      apply: round(applyMs),
      total: round(totalMs)
    },
    queryTimingsMs
  };
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    message: String(error?.message || error)
  }, null, 2));
  process.exitCode = 1;
} finally {
  database.close();
}

async function applyAllMigrations(database) {
  for (const name of await migrationFiles()) {
    database.exec(await readFile(path.join(migrationsDir, name), "utf8"));
  }
  const violations = database.prepare("PRAGMA foreign_key_check").all();
  if (violations.length) throw new Error(`migration FK violation: ${JSON.stringify(violations.slice(0, 3))}`);
}

async function migrationFiles() {
  return (await readdir(migrationsDir))
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort((left, right) => left.localeCompare(right));
}

function buildRows(total) {
  const categories = ["제조기록서", "제품사양서", "PV", "CV", "IQ", "OQ"];
  const positions = [{ rack: 1, face: "단면" }];
  for (let rack = 2; rack <= 13; rack += 1) {
    positions.push({ rack, face: "1면" }, { rack, face: "2면" });
  }
  return Array.from({ length: total }, (_, index) => {
    const position = positions[index % positions.length];
    return {
      rowNumber: index + 2,
      sourceRowKey: "",
      source: {
        documentNumber: `DOC-${String(index + 1).padStart(5, "0")}`,
        revisionNumber: `Rev.${index % 4}`,
        revisionDate: `2026-${String(index % 12 + 1).padStart(2, "0")}-01`,
        disposalDueYear: String(2028 + index % 5),
        documentName: `문서고 실사용 리허설 문서 ${index + 1}`,
        category: categories[index % categories.length],
        zoneNumber: "1",
        rackNumber: String(position.rack),
        rackColumn: String(index % 7 + 1),
        shelfNumber: String(index % 6 + 1),
        rackFace: position.face,
        tags: "중요문서;원본보관",
        note: `초기 적재 리허설 ${index + 1}`,
        status: (index + 1) % 10 === 0 ? "폐기" : "보관중"
      }
    };
  });
}

function sqliteD1(database) {
  function statement(sql, args = []) {
    return {
      sql,
      args,
      bind(...nextArgs) { return statement(sql, nextArgs); },
      async first() { return database.prepare(sql).get(...args) ?? null; },
      async all() { return { results: database.prepare(sql).all(...args) }; },
      async run() {
        const result = database.prepare(sql).run(...args);
        return { meta: { changes: Number(result.changes || 0), last_row_id: Number(result.lastInsertRowid || 0) } };
      }
    };
  }
  return {
    prepare(sql) { return statement(sql); },
    async batch(statements) {
      database.exec("BEGIN IMMEDIATE");
      try {
        const results = statements.map(({ sql, args }) => {
          if (/\bRETURNING\b/i.test(sql)) {
            const rows = database.prepare(sql).all(...args);
            return {
              results: rows,
              meta: {
                changes: Number(database.prepare("SELECT changes() AS count").get().count || 0),
                last_row_id: Number(database.prepare("SELECT last_insert_rowid() AS id").get().id || 0)
              }
            };
          }
          const result = database.prepare(sql).run(...args);
          return {
            results: [],
            meta: {
              changes: Number(result.changes || 0),
              last_row_id: Number(result.lastInsertRowid || 0)
            }
          };
        });
        database.exec("COMMIT");
        return results;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    }
  };
}

function scalar(database, sql, ...args) {
  return Number(database.prepare(sql).get(...args)?.["COUNT(*)"] || 0);
}

function assertOk(result, stage) {
  if (!result?.ok) throw new Error(`${stage} 실패: ${result?.message || "unknown"}`);
}

function parseCount(args) {
  const raw = args.find((value) => value.startsWith("--count="))?.slice("--count=".length) || "10000";
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > FREE_TIER_BUDGET.excelSnapshotMaxItems) {
    throw new TypeError(`--count는 1~${FREE_TIER_BUDGET.excelSnapshotMaxItems} 정수여야 합니다.`);
  }
  return value;
}

function measuredQuery(database, sql, ...args) {
  const startedAt = performance.now();
  database.prepare(sql).all(...args);
  return round(performance.now() - startedAt);
}

function round(value) {
  return Math.round(value * 100) / 100;
}
