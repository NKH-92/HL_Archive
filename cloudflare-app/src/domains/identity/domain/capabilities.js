import { hasPermission, isDemoReadOnly, PERMISSIONS, sessionHasManagementAccess } from "../../../permissions.js";

export function capabilitiesFromSession(session) {
  const isAdmin = session?.role === "Admin";
  const canManageDocuments = hasPermission(session, PERMISSIONS.MANAGE_DOCUMENTS);
  const canMoveDocuments = hasPermission(session, PERMISSIONS.MOVE_DOCUMENTS);
  const canManageDisposals = hasPermission(session, PERMISSIONS.MANAGE_DISPOSALS);
  const canManageSets = hasPermission(session, PERMISSIONS.MANAGE_SETS);
  const canManageMasters = hasPermission(session, PERMISSIONS.MANAGE_MASTERS);
  const canManageUsers = hasPermission(session, PERMISSIONS.MANAGE_USERS);
  const canViewAudit = hasPermission(session, PERMISSIONS.VIEW_AUDIT);
  const canApplyDocumentSnapshots = hasPermission(session, PERMISSIONS.APPLY_DOCUMENT_SNAPSHOTS);
  const demoReadOnly = isDemoReadOnly(session);
  return Object.freeze({
    isAdmin,
    isDemoReadOnly: demoReadOnly,
    canManageDocuments,
    canMoveDocuments,
    canManageDisposals,
    canManageSets,
    canManageMasters,
    canManageUsers,
    canViewAudit,
    canApplyDocumentSnapshots,
    canPreviewDocuments: canManageDocuments || demoReadOnly,
    canPreviewDocumentMoves: canMoveDocuments || demoReadOnly,
    canPreviewDisposals: canManageDisposals || demoReadOnly,
    canPreviewSets: canManageSets || demoReadOnly,
    canPreviewMasters: canManageMasters || demoReadOnly,
    canPreviewUsers: canManageUsers || demoReadOnly,
    canPreviewAudit: canViewAudit || demoReadOnly,
    canViewMovements: canMoveDocuments || canViewAudit || demoReadOnly,
    canOpenManagement: sessionHasManagementAccess(session) || demoReadOnly,
    // 기존 UI 정책: User의 직접 URL 권한과 별개로 고급 설정 메뉴는 Admin에게만 보인다.
    canShowAdminSettings: isAdmin || demoReadOnly
  });
}
