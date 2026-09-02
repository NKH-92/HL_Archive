import {
  applyRoleTemplateToUsers,
  deleteUser,
  disableUser,
  enableUser,
  getAppUser,
  getAppUsers,
  getRoleTemplate,
  getRoleTemplates,
  PASSWORD_POLICY,
  resetUserPassword,
  updateRoleTemplate,
  updateUserPermissions
} from "../domains/identity/index.js";
import { errorPage, notFoundPage } from "../views/authViews.js";
import {
  roleTemplateEditPage,
  roleTemplatesPage,
  userPermissionsPage
} from "../views/permissionViews.js";
import { userDeletePage, userPasswordResetPage } from "../views/adminViews.js";
import { CUSTOM_ROLE_TEMPLATE_KEY, PERMISSION_KEYS, permissionFlags } from "../permissions.js";
import { redirect } from "../platform/http/responses.js";

export async function renderUserPermissions(env, session, userId, error = "") {
  const [user, templates] = await Promise.all([getAppUser(env, userId), getRoleTemplates(env)]);
  if (!user) return notFoundPage(session);
  if (Number(user.security_review_required || 0) === 1) {
    return errorPage("보안 검토 대상 계정은 일반 사용자 승인·권한 변경 절차로 복구할 수 없습니다.", session, 400);
  }
  if (user.role === "Admin") {
    return errorPage("기존 Admin 계정은 항상 모든 권한을 가지므로 개별 권한을 변경하지 않습니다.", session, 400);
  }
  return userPermissionsPage({ session, user, templates, error });
}

export async function handleUserPermissions(request, env, session, userId) {
  const form = await request.formData();
  if (form.get("confirmPermissions") !== "1") {
    return renderUserPermissions(env, session, userId, "저장 후 적용될 권한 변경 결과를 확인하세요.");
  }
  const selectedKey = String(form.get("templateKey") || CUSTOM_ROLE_TEMPLATE_KEY);
  let permissions = permissionsFromForm(form);
  let roleTemplateKey = null;

  if (selectedKey !== CUSTOM_ROLE_TEMPLATE_KEY) {
    // 역할을 선택한 저장은 브라우저 script 없이도 템플릿 값이 적용되어야 하므로
    // 체크박스가 아니라 서버가 읽은 템플릿을 권한의 근거로 사용한다.
    const template = await getRoleTemplate(env, selectedKey);
    if (!template) {
      return renderUserPermissions(env, session, userId, "선택한 역할 템플릿을 찾을 수 없습니다. 목록을 새로고침하세요.");
    }
    if (renderedTemplateVersion(form, template.key) !== Number(template.row_version)) {
      return renderUserPermissions(
        env,
        session,
        userId,
        "역할 템플릿이 변경되었습니다. 화면을 새로고침한 뒤 다시 선택하세요."
      );
    }
    permissions = permissionFlags(template);
    roleTemplateKey = template.key;
  }

  const result = await updateUserPermissions(env, userId, {
    permissions,
    roleTemplateKey,
    expectedRowVersion: form.get("expectedRowVersion")
  }, session);
  if (!result.ok) {
    return renderUserPermissions(env, session, userId, result.message);
  }
  return redirect("/admin/settings?toast=permissions-saved");
}

export async function renderRoleTemplates(env, session) {
  return roleTemplatesPage({ session, templates: await getRoleTemplates(env) });
}

export async function renderRoleTemplateEdit(env, session, key, error = "") {
  const [template, users] = await Promise.all([getRoleTemplate(env, key), getAppUsers(env)]);
  if (!template) return notFoundPage(session);
  // 일괄 반영은 승인된 일반 계정만 대상으로 한다. 대기·반려·사용중지 계정은 상태 절차로 처리한다.
  const eligibleUsers = users.filter((user) => (
    user.role === "User"
    && user.access_mode !== "demo_readonly"
    && user.status === "approved"
    && Number(user.security_review_required || 0) !== 1
  ));
  return roleTemplateEditPage({ session, template, users: eligibleUsers, error });
}

export async function handleRoleTemplateUpdate(request, env, session, key) {
  const form = await request.formData();
  if (form.get("confirmTemplate") !== "1") {
    return renderRoleTemplateEdit(env, session, key, "기존 사용자에게 자동 반영되지 않음을 확인하세요.");
  }
  const result = await updateRoleTemplate(env, key, {
    label: form.get("label"),
    permissions: permissionsFromForm(form),
    expectedRowVersion: form.get("expectedRowVersion")
  }, session);
  if (!result.ok) return renderRoleTemplateEdit(env, session, key, result.message);
  return redirect(`/admin/role-templates/${encodeURIComponent(key)}/edit?toast=template-saved`);
}

export async function handleRoleTemplateBulkApply(request, env, session, key) {
  const form = await request.formData();
  if (form.get("confirmBulkApply") !== "1") {
    return renderRoleTemplateEdit(env, session, key, "선택 사용자의 개별 예외를 교체함을 확인하세요.");
  }
  const targets = form.getAll("userId").map((id) => ({
    id,
    expectedRowVersion: form.get(`rowVersion_${id}`)
  }));
  const result = await applyRoleTemplateToUsers(
    env,
    key,
    targets,
    session,
    form.get("expectedTemplateRowVersion")
  );
  if (!result.ok) return renderRoleTemplateEdit(env, session, key, result.message);
  return redirect(`/admin/role-templates/${encodeURIComponent(key)}/edit?toast=template-applied`);
}

export async function handleUserStatusAction(env, session, userId, action) {
  const mutation = action === "disable" ? disableUser : action === "enable" ? enableUser : null;
  if (!mutation) return errorPage("지원하지 않는 사용자 상태 변경입니다.", session, 400);
  const result = await mutation(env, userId, session);
  if (!result.ok) return errorPage(result.message, session, 400);
  return redirect(`/admin/settings?toast=${action === "disable" ? "disabled" : "enabled"}`);
}

export async function renderUserDelete(env, session, userId, error = "") {
  const user = await getAppUser(env, userId);
  if (!user) return notFoundPage(session);
  if (session?.role !== "Admin" && !session?.demoReadAuthorized) {
    return errorPage("계정 완전삭제는 시스템 관리자만 수행할 수 있습니다.", session, 403);
  }
  if (Number(user.id) === Number(session.userId) || user.username === session.username) {
    return errorPage("현재 로그인한 계정은 삭제할 수 없습니다.", session, 400);
  }
  return userDeletePage({ session, user, error });
}

export async function handleUserDelete(request, env, session, userId) {
  const form = await request.formData();
  if (form.get("confirmDelete") !== "1") {
    return renderUserDelete(env, session, userId, "삭제 후 계정을 되돌릴 수 없음을 확인하세요.");
  }
  const result = await deleteUser(env, userId, session, {
    confirmedUsername: form.get("confirmedUsername")
  });
  if (!result.ok) return renderUserDelete(env, session, userId, result.message);
  return redirect("/admin/settings?toast=user-deleted");
}

export async function renderUserPasswordReset(env, session, userId, error = "") {
  const user = await getAppUser(env, userId);
  if (!user) return notFoundPage(session);
  if (
    !["approved", "disabled"].includes(user.status)
    || Number(user.security_review_required || 0) === 1
  ) {
    return errorPage("승인 또는 사용중지 상태의 일반 계정만 비밀번호를 초기화할 수 있습니다.", session, 400);
  }
  if (Number(user.id) === Number(session.userId) || user.username === session.username) {
    return errorPage("현재 로그인한 계정은 비밀번호 변경 화면을 이용하세요.", session, 400);
  }
  return userPasswordResetPage({ session, user, error, minLength: PASSWORD_POLICY.minLength });
}

export async function handleUserPasswordReset(request, env, session, userId) {
  const form = await request.formData();
  const temporaryPassword = String(form.get("temporaryPassword") ?? "");
  const confirmPassword = String(form.get("confirmPassword") ?? "");

  if (!temporaryPassword || !confirmPassword) {
    return renderUserPasswordReset(env, session, userId, "임시 비밀번호와 확인값을 모두 입력하세요.");
  }
  if (temporaryPassword !== confirmPassword) {
    return renderUserPasswordReset(env, session, userId, "임시 비밀번호가 일치하지 않습니다.");
  }
  if (form.get("confirmReset") !== "1") {
    return renderUserPasswordReset(env, session, userId, "기존 세션 종료와 다음 로그인 시 변경 강제를 확인하세요.");
  }

  const result = await resetUserPassword(env, userId, temporaryPassword, session);
  if (!result.ok) return renderUserPasswordReset(env, session, userId, result.message);
  return redirect("/admin/settings?toast=password-reset");
}

function permissionsFromForm(form) {
  return Object.fromEntries(PERMISSION_KEYS.map((permission) => [permission, form.get(permission) === "1"]));
}

// 화면이 렌더링할 때 본 템플릿 버전. 저장 시점 버전과 다르면 반영하지 않는다.
function renderedTemplateVersion(form, key) {
  let versions;
  try {
    versions = JSON.parse(String(form.get("templateVersions") || "{}"));
  } catch {
    return 0;
  }
  const version = Number(versions?.[key]);
  return Number.isSafeInteger(version) && version >= 1 ? version : 0;
}
