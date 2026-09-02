import { accessDeniedPage } from "../views/authViews.js";
import { hasAnyPermission, hasReadPermission, PERMISSIONS, sessionHasManagementAccess } from "../permissions.js";

export function requirePermission(session, permission) {
  const required = String(permission || "").split("+").map((part) => part.trim()).filter(Boolean);
  if (!required.length) return accessDeniedPage(session);
  return required.every((part) => hasReadPermission(session, part)) ? null : accessDeniedPage(session);
}

export function requireManagementAccess(session) {
  return session?.demoReadAuthorized || sessionHasManagementAccess(session) ? null : accessDeniedPage(session);
}

export function requireAnyPermission(session, permissions) {
  return session?.demoReadAuthorized || hasAnyPermission(session, permissions) ? null : accessDeniedPage(session);
}

export const requireManageDocuments = (session) => requirePermission(session, PERMISSIONS.MANAGE_DOCUMENTS);
export const requireMoveDocuments = (session) => requirePermission(session, PERMISSIONS.MOVE_DOCUMENTS);
export const requireManageDisposals = (session) => requirePermission(session, PERMISSIONS.MANAGE_DISPOSALS);
export const requireManageSets = (session) => requirePermission(session, PERMISSIONS.MANAGE_SETS);
export const requireManageMasters = (session) => requirePermission(session, PERMISSIONS.MANAGE_MASTERS);
export const requireManageUsers = (session) => requirePermission(session, PERMISSIONS.MANAGE_USERS);
export const requireViewAudit = (session) => requirePermission(session, PERMISSIONS.VIEW_AUDIT);
export const requireApplyDocumentSnapshots = (session) => requirePermission(session, PERMISSIONS.APPLY_DOCUMENT_SNAPSHOTS);
