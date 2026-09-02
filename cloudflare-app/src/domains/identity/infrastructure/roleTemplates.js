import { createSystemAuditStatement } from "../../audit/index.js";
import { actorUsername } from "../domain/actor.js";
import { createBatchPlan } from "../../../platform/d1/batchPlan.js";
import {
  exactChangeCountAssertionSql,
  isExpectedChangeAbort
} from "../../../platform/d1/expectedChange.js";
import { executeMutationBatch } from "../../../platform/d1/requestGateway.js";
import { PERMISSION_KEYS, permissionFlags, samePermissions } from "../../../permissions.js";
import { clean } from "../../../shared/text/normalize.js";

const SYSTEM_TEMPLATE_KEY = "system_admin";
const MAX_BULK_USERS = 38;
const TEMPLATE_COLUMNS = `
  key,
  label,
  ${PERMISSION_KEYS.join(",\n  ")},
  row_version,
  updated_at,
  updated_by
`;

export async function getRoleTemplates(env) {
  const result = await env.DB.prepare(`
    SELECT ${TEMPLATE_COLUMNS}
    FROM user_role_templates
    ORDER BY CASE key WHEN 'viewer' THEN 0 WHEN 'document_manager' THEN 1 WHEN 'system_admin' THEN 2 ELSE 3 END, key
  `).all();
  return (result.results ?? []).map(presentTemplate);
}

export async function getRoleTemplate(env, key) {
  const template = await env.DB.prepare(`
    SELECT ${TEMPLATE_COLUMNS}
    FROM user_role_templates
    WHERE key = ?
  `).bind(normalizeKey(key)).first();
  return template ? presentTemplate(template) : null;
}

export async function updateRoleTemplate(env, key, values, actor) {
  if (actor?.role !== "Admin") {
    return { ok: false, message: "역할 템플릿은 시스템 관리자만 수정할 수 있습니다." };
  }
  const normalizedKey = normalizeKey(key);
  if (normalizedKey === SYSTEM_TEMPLATE_KEY) {
    return { ok: false, message: "시스템관리 역할 템플릿은 수정할 수 없습니다." };
  }
  const label = clean(values?.label);
  const expectedRowVersion = readRowVersion(values?.expectedRowVersion);
  if (!label || label.length > 50 || !expectedRowVersion) {
    return { ok: false, message: "역할 이름과 현재 버전을 확인하세요." };
  }

  const current = await getRoleTemplate(env, normalizedKey);
  if (!current) return { ok: false, message: "역할 템플릿을 찾을 수 없습니다." };
  if (Number(current.row_version) !== expectedRowVersion) return staleResult();

  const beforePermissions = permissionFlags(current);
  const afterPermissions = permissionFlags(values?.permissions);
  if (current.label === label && samePermissions(beforePermissions, afterPermissions)) {
    return { ok: true, unchanged: true };
  }

  const guardSql = "FROM user_role_templates WHERE key = ? AND row_version = ? AND key <> 'system_admin'";
  const guardBinds = [normalizedKey, expectedRowVersion];
  const audit = createSystemAuditStatement(env, {
    entityType: "user_role_template",
    entityId: normalizedKey,
    entityReference: current.label,
    action: "role_template_update",
    actor,
    summary: "역할 템플릿 변경",
    details: {
      before: { label: current.label, permissions: beforePermissions, rowVersion: expectedRowVersion },
      after: { label, permissions: afterPermissions, rowVersion: expectedRowVersion + 1 }
    }
  }, { guardSql, guardBinds });
  const update = env.DB.prepare(`
    UPDATE user_role_templates
    SET label = ?,
        ${PERMISSION_KEYS.map((permission) => `${permission} = ?`).join(",\n        ")},
        row_version = row_version + 1,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = ?
    WHERE key = ? AND row_version = ? AND key <> 'system_admin'
  `).bind(
    label,
    ...permissionValues(afterPermissions),
    actorUsername(actor),
    normalizedKey,
    expectedRowVersion
  );
  const plan = createBatchPlan("identity.role-template.update")
    .step("role-template.audit.update", audit, {
      guard: `user_role_templates:${normalizedKey}:${expectedRowVersion}`,
      auditEventId: "role_template_update"
    })
    .step("role-template.update", update, { guard: `user_role_templates:${normalizedKey}:${expectedRowVersion}` })
    .expectChanged("role-template.update")
    .withBudget(2);

  try {
    await executeMutationBatch(env, plan);
    return { ok: true };
  } catch (error) {
    if (isExpectedChangeAbort(error)) return staleResult();
    throw error;
  }
}

export async function applyRoleTemplateToUsers(env, key, targets, actor, expectedTemplateRowVersionValue) {
  if (actor?.role !== "Admin") {
    return { ok: false, message: "역할 일괄 반영은 시스템 관리자만 실행할 수 있습니다." };
  }
  const normalizedTargets = normalizeTargets(targets);
  if (!normalizedTargets.length) {
    return { ok: false, message: "역할을 반영할 사용자를 한 명 이상 선택하세요." };
  }
  if (normalizedTargets.length > MAX_BULK_USERS) {
    return { ok: false, message: `한 번에 최대 ${MAX_BULK_USERS}명까지 반영할 수 있습니다.` };
  }

  const expectedTemplateRowVersion = readRowVersion(expectedTemplateRowVersionValue);
  const template = await getRoleTemplate(env, key);
  if (!template) return { ok: false, message: "역할 템플릿을 찾을 수 없습니다." };
  if (!expectedTemplateRowVersion || template.row_version !== expectedTemplateRowVersion) {
    return staleResult("역할 템플릿이 변경되었습니다. 화면을 새로고침한 뒤 다시 시도하세요.");
  }
  const placeholders = normalizedTargets.map(() => "?").join(", ");
  const usersResult = await env.DB.prepare(`
    SELECT id, username, display_name, role, status, security_review_required, access_mode, role_template_key, row_version,
      ${PERMISSION_KEYS.join(", ")}
    FROM app_users
    WHERE id IN (${placeholders})
  `).bind(...normalizedTargets.map(({ id }) => id)).all();
  const users = usersResult.results ?? [];
  const expectedById = new Map(normalizedTargets.map((target) => [target.id, target.expectedRowVersion]));
  if (
    users.length !== normalizedTargets.length
    || users.some((user) => (
      user.role !== "User"
      || user.access_mode === "demo_readonly"
      || user.status !== "approved"
      || Number(user.security_review_required || 0) === 1
      || Number(user.row_version) !== expectedById.get(Number(user.id))
    ))
  ) {
    return staleResult("선택한 사용자 정보가 변경되었습니다. 목록을 새로고침한 뒤 다시 시도하세요.");
  }

  const permissions = permissionFlags(template);
  const plan = createBatchPlan("identity.role-template.users.bulk-apply");
  for (const user of users) {
    const expectedRowVersion = expectedById.get(Number(user.id));
    const guardSql = `
      FROM app_users
      WHERE id = ?
        AND role = 'User'
        AND status = 'approved'
        AND access_mode = 'standard'
        AND security_review_required = 0
        AND row_version = ?
        AND EXISTS (
          SELECT 1
          FROM user_role_templates
          WHERE key = ? AND row_version = ?
        )
    `;
    const guardBinds = [Number(user.id), expectedRowVersion, template.key, expectedTemplateRowVersion];
    plan.step(`user.${user.id}.audit.role-template`, createSystemAuditStatement(env, {
      entityType: "user",
      entityId: user.id,
      entityReference: user.username,
      action: "role_template_apply",
      actor,
      summary: "사용자 역할 템플릿 일괄 반영",
      details: {
        before: {
          roleTemplateKey: user.role_template_key || null,
          permissions: permissionFlags(user),
          rowVersion: expectedRowVersion
        },
        after: {
          roleTemplateKey: template.key,
          permissions,
          rowVersion: expectedRowVersion + 1
        }
      }
    }, { guardSql, guardBinds }), {
      guard: `app_users:${user.id}:${expectedRowVersion}`,
      auditEventId: "role_template_apply"
    });
  }

  const targetPredicate = normalizedTargets.map(() => "(id = ? AND row_version = ?)").join(" OR ");
  const update = env.DB.prepare(`
    UPDATE app_users
    SET role_template_key = ?,
        ${PERMISSION_KEYS.map((permission) => `${permission} = ?`).join(",\n        ")},
        row_version = row_version + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE role = 'User'
      AND status = 'approved'
      AND access_mode = 'standard'
      AND security_review_required = 0
      AND EXISTS (
        SELECT 1
        FROM user_role_templates current_template
        WHERE current_template.key = ? AND current_template.row_version = ?
      )
      AND (${targetPredicate})
  `).bind(
    template.key,
    ...permissionValues(permissions),
    template.key,
    expectedTemplateRowVersion,
    ...normalizedTargets.flatMap(({ id, expectedRowVersion }) => [id, expectedRowVersion])
  );
  plan.step("users.role-template.bulk-update", update, { guard: `${normalizedTargets.length} selected users` });
  plan.step(
    "users.role-template.bulk-assert",
    env.DB.prepare(exactChangeCountAssertionSql(String(normalizedTargets.length))),
    { guard: `${normalizedTargets.length} changed users` }
  );
  plan.withBudget(normalizedTargets.length + 2);

  try {
    await executeMutationBatch(env, plan);
    return { ok: true, appliedCount: normalizedTargets.length };
  } catch (error) {
    if (isExpectedChangeAbort(error)) {
      return staleResult("일부 사용자 정보가 변경되어 전체 반영을 취소했습니다. 목록을 새로고침한 뒤 다시 시도하세요.");
    }
    throw error;
  }
}

function presentTemplate(template) {
  return {
    ...template,
    key: String(template.key),
    label: String(template.label),
    row_version: Number(template.row_version),
    fixed: template.key === SYSTEM_TEMPLATE_KEY,
    ...permissionFlags(template)
  };
}

function normalizeKey(value) {
  const key = clean(value).toLowerCase();
  return /^[a-z0-9_]{1,40}$/.test(key) ? key : "";
}

function readRowVersion(value) {
  const version = Number(value);
  return Number.isSafeInteger(version) && version >= 1 ? version : 0;
}

function normalizeTargets(targets) {
  const seen = new Set();
  const normalized = [];
  for (const target of Array.isArray(targets) ? targets : []) {
    const id = Number(target?.id);
    const expectedRowVersion = readRowVersion(target?.expectedRowVersion);
    if (!Number.isSafeInteger(id) || id < 1 || !expectedRowVersion || seen.has(id)) continue;
    seen.add(id);
    normalized.push({ id, expectedRowVersion });
  }
  return normalized;
}

function permissionValues(source) {
  return PERMISSION_KEYS.map((permission) => source[permission] ? 1 : 0);
}

function staleResult(message = "역할 정보가 변경되었습니다. 새로고침 후 다시 시도하세요.") {
  return { ok: false, stale: true, message };
}
