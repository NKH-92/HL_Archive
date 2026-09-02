export const PERMISSIONS = Object.freeze({
  MANAGE_DOCUMENTS: "can_manage_documents",
  MOVE_DOCUMENTS: "can_move_documents",
  MANAGE_DISPOSALS: "can_manage_disposals",
  MANAGE_SETS: "can_manage_sets",
  MANAGE_MASTERS: "can_manage_masters",
  MANAGE_USERS: "can_manage_users",
  VIEW_AUDIT: "can_view_audit",
  APPLY_DOCUMENT_SNAPSHOTS: "can_apply_document_snapshots"
});

export const PERMISSION_KEYS = Object.freeze(Object.values(PERMISSIONS));

export const PERMISSION_LABELS = Object.freeze({
  [PERMISSIONS.MANAGE_DOCUMENTS]: "문서 등록·수정",
  [PERMISSIONS.MOVE_DOCUMENTS]: "문서 위치 이동",
  [PERMISSIONS.MANAGE_DISPOSALS]: "폐기 관리",
  [PERMISSIONS.MANAGE_SETS]: "준비 문서 세트 관리",
  [PERMISSIONS.MANAGE_MASTERS]: "랙·대분류·태그 관리",
  [PERMISSIONS.MANAGE_USERS]: "사용자·권한 관리",
  [PERMISSIONS.VIEW_AUDIT]: "전역 감사조회",
  [PERMISSIONS.APPLY_DOCUMENT_SNAPSHOTS]: "엑셀 전체 대장 반영"
});

// 역할 정의의 단일 출처는 D1의 user_role_templates다(migration 0045).
// 아래 값은 "템플릿을 쓰지 않는 개별 예외" 선택을 나타내는 화면·핸들러 공용 표식이다.
export const CUSTOM_ROLE_TEMPLATE_KEY = "custom";

export const ACCESS_MODES = Object.freeze({
  STANDARD: "standard",
  DEMO_READONLY: "demo_readonly"
});

export function isDemoReadOnly(session) {
  return session?.accessMode === ACCESS_MODES.DEMO_READONLY;
}

const permissionSet = new Set(PERMISSION_KEYS);

// 기존 Admin은 하위 호환을 위해 플래그 값과 관계없이 모든 권한을 가진다.
export function hasPermission(session, permission) {
  if (!session || !permissionSet.has(permission)) {
    return false;
  }
  if (isDemoReadOnly(session)) {
    return false;
  }
  if (session.role === "Admin") {
    return true;
  }
  return session.role === "User" && readPermissionFlag(session[permission]);
}

// 시연 계정의 조회 권한은 라우트 레지스트리에서 허용한 GET 요청에만 일시적으로 부여한다.
// 일반 권한과 분리해 도메인 mutation이 이 값을 쓰지 못하게 한다.
export function hasReadPermission(session, permission) {
  return Boolean(isDemoReadOnly(session) && session?.demoReadAuthorized)
    || hasPermission(session, permission);
}

export function hasAnyPermission(session, permissions = PERMISSION_KEYS) {
  return Array.from(permissions || []).some((permission) => hasPermission(session, permission));
}

export function sessionHasManagementAccess(session) {
  return Boolean(session?.demoReadAuthorized) || hasAnyPermission(session, PERMISSION_KEYS);
}

export function permissionFlags(source = {}) {
  return Object.fromEntries(PERMISSION_KEYS.map((permission) => [
    permission,
    readPermissionFlag(source[permission])
  ]));
}

export function permissionSnapshot(session = {}) {
  if (session.role === "Admin") {
    return Object.fromEntries(PERMISSION_KEYS.map((permission) => [permission, true]));
  }
  return permissionFlags(session);
}

export function samePermissions(left, right) {
  const leftFlags = permissionFlags(left);
  const rightFlags = permissionFlags(right);
  return PERMISSION_KEYS.every((permission) => leftFlags[permission] === rightFlags[permission]);
}

function readPermissionFlag(value) {
  return value === true || value === 1 || value === "1";
}
