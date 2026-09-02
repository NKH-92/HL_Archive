import { createPasswordRecord, isPasswordInputBounded } from "../../../auth/passwords.js";
import { permissionFlags, PERMISSION_KEYS } from "../../../permissions.js";
import { createSystemAuditStatement } from "../../audit/index.js";
import { actorUsername } from "../domain/actor.js";
import { validateNewPassword } from "../domain/passwordPolicy.js";
import { canTransitionUser, transitionFor, userDeletionRefusal } from "../domain/userState.js";
import { validateApprovedUser } from "../domain/approvedUser.js";
import {
  createApprovedUserMutationPlan,
  createUserPasswordResetMutationPlan,
  createUserPermissionMutationPlan,
  createUserDeleteMutationPlan,
  createUserStatusMutationPlan
} from "./userMutationPlans.js";
import { executeMutationBatch } from "../../../platform/d1/requestGateway.js";
import { clean } from "../../../shared/text/normalize.js";

// app_users.row_version은 역할·권한 화면이 OCC로 사용하는 값이다. 권한 판단 근거를 바꾸는
// 상태·역할·템플릿·권한 변경은 증가시키고 credential/session_epoch 전용 변경은 증가시키지 않는다.
const USER_PERMISSION_COLUMNS = PERMISSION_KEYS.join(", ");
const MATCHED_ROLE_TEMPLATE_LABEL = `(
  SELECT label
  FROM user_role_templates
  WHERE key = app_users.role_template_key
    AND ${PERMISSION_KEYS.map((permission) => (
      `user_role_templates.${permission} = app_users.${permission}`
    )).join("\n    AND ")}
)`;

export async function createApprovedUser(env, values, actor) {
  if (actor?.role !== "Admin") {
    return { ok: false, message: "승인 사용자 추가는 시스템 관리자만 수행할 수 있습니다." };
  }

  const validation = validateApprovedUser(values);
  if (!validation.ok) return validation;
  const temporaryPassword = String(values?.temporaryPassword ?? "");
  if (!isPasswordInputBounded(temporaryPassword)) {
    return { ok: false, values: validation.values, message: "임시 비밀번호가 허용된 최대 길이를 초과했습니다." };
  }
  const passwordValidation = validateNewPassword(temporaryPassword, { label: "임시 비밀번호" });
  if (!passwordValidation.ok) return { ...passwordValidation, values: validation.values };

  const user = validation.values;
  const existing = await env.DB.prepare("SELECT id FROM app_users WHERE username = ?").bind(user.username).first();
  if (existing) {
    return { ok: false, values: user, duplicate: true, message: "이미 등록된 사용자 아이디입니다." };
  }

  const passwordRecord = await createPasswordRecord(temporaryPassword);
  const approvedBy = actorUsername(actor);
  const guardSql = `
    FROM (SELECT 1) AS approved_user_candidate
    WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE username = ?)
  `;
  const guardBinds = [user.username];
  const permissions = Object.fromEntries(PERMISSION_KEYS.map((permission) => [permission, false]));
  const audit = createSystemAuditStatement(env, {
    entityType: "user",
    entityReference: user.username,
    action: "create_approved",
    actor,
    summary: "승인 사용자 추가",
    details: {
      before: null,
      after: {
        username: user.username,
        displayName: user.displayName,
        team: user.team || null,
        status: "approved",
        role: "User",
        roleTemplateKey: "viewer",
        permissions,
        mustChangePassword: true
      }
    }
  }, { guardSql, guardBinds });
  const insert = env.DB.prepare(`
    INSERT INTO app_users (
      username,
      display_name,
      team,
      password_salt,
      password_hash,
      status,
      approved_at,
      approved_by,
      role,
      role_template_key,
      must_change_password,
      security_review_required,
      ${PERMISSION_KEYS.join(", ")},
      updated_at
    )
    SELECT ?, ?, ?, ?, ?, 'approved', CURRENT_TIMESTAMP, ?, 'User', 'viewer', 1, 0,
      ${PERMISSION_KEYS.map(() => "0").join(", ")},
      CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE username = ?)
  `).bind(
    user.username,
    user.displayName,
    user.team || null,
    passwordRecord.salt,
    passwordRecord.hash,
    approvedBy,
    user.username
  );
  const plan = createApprovedUserMutationPlan(audit, insert, `app_users:${user.username}:absent`);

  try {
    await executeMutationBatch(env, plan);
    return { ok: true, username: user.username, displayName: user.displayName };
  } catch (error) {
    if (error?.code === "STALE_VERSION" || /UNIQUE constraint failed/i.test(String(error?.message || ""))) {
      return { ok: false, values: user, duplicate: true, message: "이미 등록된 사용자 아이디입니다." };
    }
    throw error;
  }
}

export async function getAppUsers(env) {
  const result = await env.DB.prepare(`
    SELECT
      id,
      username,
      display_name,
      status,
      role,
      requested_at,
      approved_at,
      approved_by,
      rejected_at,
      rejected_by,
      must_change_password,
      security_review_required,
      session_epoch,
      team,
      access_mode,
      role_template_key,
      row_version,
      ${MATCHED_ROLE_TEMPLATE_LABEL} AS role_template_label,
      updated_at,
      ${USER_PERMISSION_COLUMNS}
    FROM app_users
    ORDER BY
      CASE role WHEN 'Admin' THEN 0 ELSE 1 END,
      CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 WHEN 'disabled' THEN 2 ELSE 3 END,
      requested_at DESC,
      id DESC
  `).all();
  return result.results ?? [];
}

export async function getAppUser(env, id) {
  return env.DB.prepare(`
    SELECT
      id,
      username,
      display_name,
      status,
      role,
      requested_at,
      approved_at,
      approved_by,
      rejected_at,
      rejected_by,
      must_change_password,
      security_review_required,
      session_epoch,
      team,
      access_mode,
      role_template_key,
      row_version,
      ${MATCHED_ROLE_TEMPLATE_LABEL} AS role_template_label,
      updated_at,
      ${USER_PERMISSION_COLUMNS}
    FROM app_users
    WHERE id = ?
  `).bind(id).first();
}

export async function approveUser(env, id, actor) {
  return transitionUserStatus(env, id, actor, {
    action: "approve",
    summary: "사용자 승인",
    updateSql: `
      status = 'approved',
      approved_at = CURRENT_TIMESTAMP,
      approved_by = ?,
      rejected_at = NULL,
      rejected_by = NULL,
      row_version = row_version + 1,
      updated_at = CURRENT_TIMESTAMP
    `,
    updateBinds: [actorUsername(actor)]
  });
}

export async function rejectUser(env, id, actor) {
  return transitionUserStatus(env, id, actor, {
    action: "reject",
    summary: "가입 요청 반려",
    updateSql: `
      status = 'rejected',
      approved_at = NULL,
      approved_by = NULL,
      rejected_at = CURRENT_TIMESTAMP,
      rejected_by = ?,
      row_version = row_version + 1,
      updated_at = CURRENT_TIMESTAMP
    `,
    updateBinds: [actorUsername(actor)]
  });
}

export async function disableUser(env, id, actor) {
  return transitionUserStatus(env, id, actor, {
    action: "disable",
    summary: "사용자 사용중지",
    updateSql: "status = 'disabled', session_epoch = session_epoch + 1, row_version = row_version + 1, updated_at = CURRENT_TIMESTAMP"
  });
}

export async function enableUser(env, id, actor) {
  return transitionUserStatus(env, id, actor, {
    action: "enable",
    summary: "사용자 다시 사용",
    updateSql: "status = 'approved', session_epoch = session_epoch + 1, row_version = row_version + 1, updated_at = CURRENT_TIMESTAMP"
  });
}

export async function updateUserPermissions(env, id, values, actor) {
  const user = await getAppUser(env, id);
  const expectedRowVersion = Number(values?.expectedRowVersion);
  if (
    !user
    || user.role !== "User"
    || user.access_mode === "demo_readonly"
    || Number(user.security_review_required || 0) === 1
    || !Number.isSafeInteger(expectedRowVersion)
    || expectedRowVersion < 1
  ) {
    return { ok: false, message: "권한을 변경할 사용자를 찾을 수 없습니다." };
  }
  if (Number(user.row_version) !== expectedRowVersion) {
    return { ok: false, stale: true, message: "사용자 정보가 변경되었습니다. 새로고침 후 다시 시도하세요." };
  }

  const beforePermissions = permissionFlags(user);
  const afterPermissions = permissionFlags(values?.permissions);
  const beforeRoleTemplateKey = user.role_template_key || null;
  const roleTemplateKey = /^[a-z0-9_]{1,40}$/.test(String(values?.roleTemplateKey || ""))
    ? String(values.roleTemplateKey)
    : null;
  if (
    beforeRoleTemplateKey === roleTemplateKey
    && PERMISSION_KEYS.every((permission) => beforePermissions[permission] === afterPermissions[permission])
  ) {
    return { ok: true, unchanged: true };
  }

  const guardSql = "FROM app_users WHERE id = ? AND role = 'User' AND access_mode = 'standard' AND security_review_required = 0 AND row_version = ?";
  const guardBinds = [user.id, expectedRowVersion];
  const audit = createSystemAuditStatement(env, {
    entityType: "user",
    entityId: user.id,
    entityReference: user.username,
    action: "permissions_update",
    actor,
    summary: "사용자 역할·권한 변경",
    details: {
      before: {
        roleTemplateKey: beforeRoleTemplateKey,
        permissions: beforePermissions,
        rowVersion: expectedRowVersion
      },
      after: {
        roleTemplateKey,
        permissions: afterPermissions,
        rowVersion: expectedRowVersion + 1
      }
    }
  }, { guardSql, guardBinds });
  const valuesToBind = PERMISSION_KEYS.map((permission) => afterPermissions[permission] ? 1 : 0);
  const update = env.DB.prepare(`
    UPDATE app_users
    SET role_template_key = ?,
        ${PERMISSION_KEYS.map((permission) => `${permission} = ?`).join(",\n        ")},
        row_version = row_version + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND role = 'User' AND access_mode = 'standard' AND security_review_required = 0 AND row_version = ?
  `).bind(roleTemplateKey, ...valuesToBind, user.id, expectedRowVersion);
  const plan = createUserPermissionMutationPlan(audit, update, `app_users:${user.id}:${expectedRowVersion}`);

  try {
    await executeMutationBatch(env, plan);
    return { ok: true };
  } catch (error) {
    if (error?.code === "STALE_VERSION") {
      return { ok: false, stale: true, message: "사용자 정보가 변경되었습니다. 새로고침 후 다시 시도하세요." };
    }
    throw error;
  }
}

export async function resetUserPassword(env, id, temporaryPassword, actor) {
  if (actor?.role !== "Admin") {
    return { ok: false, message: "비밀번호 초기화는 시스템 관리자만 수행할 수 있습니다." };
  }

  const user = await getAppUser(env, id);
  if (
    !user
    || !["approved", "disabled"].includes(user.status)
    || Number(user.security_review_required || 0) === 1
  ) {
    return { ok: false, message: "비밀번호를 초기화할 사용자를 찾을 수 없습니다." };
  }
  if (Number(user.id) === Number(actor.userId) || user.username === actor.username) {
    return { ok: false, message: "현재 로그인한 계정은 비밀번호 변경 화면을 이용하세요." };
  }

  const passwordValidation = validateNewPassword(temporaryPassword, { label: "임시 비밀번호" });
  if (!passwordValidation.ok) return passwordValidation;

  const passwordRecord = await createPasswordRecord(temporaryPassword);
  const currentSessionEpoch = Number(user.session_epoch || 0);
  const nextSessionEpoch = currentSessionEpoch + 1;
  const guardSql = `
    FROM app_users
    WHERE id = ?
      AND username = ?
      AND status IN ('approved', 'disabled')
      AND security_review_required = 0
      AND session_epoch = ?
  `;
  const guardBinds = [user.id, user.username, currentSessionEpoch];
  const audit = createSystemAuditStatement(env, {
    entityType: "user",
    entityId: user.id,
    entityReference: user.username,
    action: "password_reset",
    actor,
    summary: "사용자 비밀번호 초기화",
    details: {
      before: {
        status: user.status,
        role: user.role,
        mustChangePassword: Number(user.must_change_password || 0) === 1,
        sessionEpoch: currentSessionEpoch
      },
      after: {
        status: user.status,
        role: user.role,
        mustChangePassword: true,
        sessionEpoch: nextSessionEpoch
      }
    }
  }, { guardSql, guardBinds });
  const clearThrottle = env.DB.prepare(`
    DELETE FROM login_throttle
    WHERE username = ?
       OR substr(username, 1, length(?) + 1) = ? || '|'
  `).bind(user.username, user.username, user.username);
  const update = env.DB.prepare(`
    UPDATE app_users
    SET password_salt = ?,
        password_hash = ?,
        must_change_password = 1,
        session_epoch = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND username = ?
      AND status IN ('approved', 'disabled')
      AND security_review_required = 0
      AND session_epoch = ?
  `).bind(
    passwordRecord.salt,
    passwordRecord.hash,
    nextSessionEpoch,
    user.id,
    user.username,
    currentSessionEpoch
  );
  const plan = createUserPasswordResetMutationPlan(
    audit,
    clearThrottle,
    update,
    `app_users:${user.id}:password:${currentSessionEpoch}`
  );
  const results = await executeMutationBatch(env, plan);

  return changed(results[2])
    ? { ok: true }
    : { ok: false, message: "사용자 인증 상태가 변경되었습니다. 새로고침 후 다시 시도하세요." };
}

// 테스트·검증 단계에서 만들어진 계정을 대장에서 지운다. 계정 행은 사라지지만 감사 이력의
// actor_user_id에는 FK가 없어 이 계정이 남긴 과거 작업 증적은 그대로 보존된다.
/**
 * @param {any} env
 * @param {string | number} id
 * @param {Record<string, any>} actor
 * @param {{ confirmedUsername?: unknown }} [confirmation]
 */
export async function deleteUser(env, id, actor, confirmation = {}) {
  const user = await getAppUser(env, id);
  const remainingAdminCount = user?.role === "Admin" ? await countOtherAdmins(env, user.id) : 0;
  const refusal = userDeletionRefusal(user, actor, { remainingAdminCount });
  if (refusal) return { ok: false, message: refusal };
  if (clean(confirmation.confirmedUsername) !== user.username) {
    return { ok: false, message: "삭제를 확정하려면 계정 아이디를 정확히 입력하세요." };
  }

  const guardSql = "FROM app_users WHERE id = ? AND username = ? AND row_version = ?";
  const guardBinds = [user.id, user.username, Number(user.row_version)];
  const audit = createSystemAuditStatement(env, {
    entityType: "user",
    entityId: user.id,
    entityReference: user.username,
    action: "delete",
    actor,
    summary: "사용자 계정 완전삭제",
    details: { before: userAuditSnapshot(user), after: null }
  }, { guardSql, guardBinds });
  const clearThrottle = env.DB.prepare("DELETE FROM login_throttle WHERE username = ?").bind(user.username);
  const remove = env.DB.prepare(`
    DELETE FROM app_users
    WHERE id = ? AND username = ? AND row_version = ?
  `).bind(user.id, user.username, Number(user.row_version));
  const plan = createUserDeleteMutationPlan(audit, clearThrottle, remove, `app_users:${user.id}:${user.row_version}`);

  try {
    const results = await executeMutationBatch(env, plan);
    return changed(results[2])
      ? { ok: true, username: user.username, displayName: user.display_name }
      : { ok: false, message: "사용자 정보가 변경되었습니다. 새로고침 후 다시 시도하세요." };
  } catch (error) {
    if (error?.code === "STALE_VERSION") {
      return { ok: false, message: "사용자 정보가 변경되었습니다. 새로고침 후 다시 시도하세요." };
    }
    throw error;
  }
}

async function countOtherAdmins(env, excludedId) {
  const row = await env.DB.prepare(`
    SELECT COUNT(*) AS total
    FROM app_users
    WHERE role = 'Admin'
      AND status = 'approved'
      AND security_review_required = 0
      AND id <> ?
  `).bind(excludedId).first();
  return Number(row?.total || 0);
}

async function transitionUserStatus(env, id, actor, spec) {
  const transition = transitionFor(spec.action);
  const user = await getAppUser(env, id);
  if (!canTransitionUser(user, spec.action)) {
    return { ok: false, message: "처리할 수 있는 사용자를 찾지 못했습니다." };
  }

  const placeholders = transition.from.map(() => "?").join(", ");
  const guardSql = `FROM app_users WHERE id = ? AND role = 'User' AND security_review_required = 0 AND status IN (${placeholders})`;
  const guardBinds = [user.id, ...transition.from];
  const audit = createSystemAuditStatement(env, {
    entityType: "user",
    entityId: user.id,
    entityReference: user.username,
    action: spec.action,
    actor,
    summary: spec.summary,
    details: {
      before: userAuditSnapshot(user),
      after: { ...userAuditSnapshot(user), status: transition.to }
    }
  }, { guardSql, guardBinds });
  const update = env.DB.prepare(`
    UPDATE app_users
    SET ${spec.updateSql}
    WHERE id = ? AND role = 'User' AND security_review_required = 0 AND status IN (${placeholders})
  `).bind(...(spec.updateBinds || []), user.id, ...transition.from);
  const plan = createUserStatusMutationPlan(spec.action, audit, update, `app_users:${user.id}:${transition.from.join("|")}`);
  const results = await executeMutationBatch(env, plan);

  return changed(results[1])
    ? { ok: true }
    : { ok: false, message: "사용자 상태가 변경되었습니다. 새로고침 후 다시 시도하세요." };
}

function userAuditSnapshot(user) {
  return {
    username: user.username,
    displayName: user.display_name,
    role: user.role,
    status: user.status,
    permissions: permissionFlags(user)
  };
}

function changed(result) {
  return Number(result?.meta?.changes || 0) > 0;
}
