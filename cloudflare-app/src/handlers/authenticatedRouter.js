// 인증 이후 애플리케이션 라우트. path를 다시 해석하지 않고 routeRegistry 결과로 dispatch한다.
import { accessDeniedPage, notFoundPage } from "../views/authViews.js";
import { isDemoReadOnly, sessionHasManagementAccess } from "../permissions.js";
import { redirect } from "../platform/http/responses.js";
import { resolveAuthenticatedRoute } from "../app/routeRegistry.js";
import { requireAdmin } from "./guards.js";
import {
  handleAdminDashboard,
  handleAdminSettings,
  handleAdminUserAction,
  handleApprovedUserCreate,
  handleChangePassword,
  renderApprovedUserCreate,
  renderPasswordPage
} from "./adminHandlers.js";
import { handleSystemAudit } from "./auditHandlers.js";
import { handleDataQuality } from "./dataQualityHandlers.js";
import { routeDocumentRequest } from "./documentRouter.js";
import { routeMasterRequest } from "./masterRouter.js";
import { handleMovementHistory } from "./movementHandlers.js";
import { requireManageUsers, requireViewAudit } from "./permissionGuards.js";
import {
  handleRoleTemplateBulkApply,
  handleRoleTemplateUpdate,
  handleUserDelete,
  handleUserPermissions,
  handleUserPasswordReset,
  handleUserStatusAction,
  renderRoleTemplateEdit,
  renderRoleTemplates,
  renderUserDelete,
  renderUserPasswordReset,
  renderUserPermissions
} from "./userPermissionHandlers.js";
import {
  handleAdminSearchReport,
  handleDashboard,
  handleFloorPlan,
  handleSearchClick,
  handleSearchIndex,
  handleSearchSuggestions,
  handleViewerSearch,
  renderQa
} from "./viewerHandlers.js";
import { routeWorkflowRequest } from "./workflowRouter.js";

export async function routeAuthenticatedRequest(request, env, session, url, path, effects = {}) {
  const resolved = resolveAuthenticatedRoute(path, request.method);
  if (!resolved) return notFoundPage(session);

  if (isDemoReadOnly(session)) {
    const demoAccess = resolved.descriptor.demoAccess;
    const allowed = demoAccess === "screen"
      || demoAccess === "interactive-read"
      || (demoAccess === "forced-password" && session.mustChangePassword);
    if (!allowed) return accessDeniedPage(session);
    if (request.method === "GET") session = { ...session, demoReadAuthorized: true };
  }

  const routeId = resolved.descriptor.id;
  const params = resolved.params;

  if (routeId === "home.redirect") return redirect("/app");
  if (routeId === "search.home") return handleDashboard(request, env, session);
  if (routeId === "floor-plan.read") return handleFloorPlan(env, session);
  if (routeId === "qa.read") return renderQa(session, env);
  if (routeId === "search.suggestions") return handleSearchSuggestions(request, env);
  if (routeId === "search.viewer") return handleViewerSearch(request, env);
  if (routeId === "search.index") return handleSearchIndex();
  if (routeId === "search.click") return handleSearchClick(request, env);

  if (routeId === "session.password.form") return renderPasswordPage(session);
  if (routeId === "session.password.change") return handleChangePassword(request, env, session);

  if (routeId === "admin.dashboard") {
    return sessionHasManagementAccess(session) ? handleAdminDashboard(env, session) : accessDeniedPage(session);
  }
  if (routeId === "admin.settings") return requireManageUsers(session) ?? handleAdminSettings(env, session);
  if (routeId === "admin.user.create.form") {
    return requireManageUsers(session) ?? requireAdmin(session) ?? renderApprovedUserCreate(session);
  }
  if (routeId === "admin.user.create") {
    return requireManageUsers(session) ?? requireAdmin(session) ?? handleApprovedUserCreate(request, env, session);
  }
  if (routeId === "admin.role-templates") {
    return requireManageUsers(session) ?? requireAdmin(session) ?? renderRoleTemplates(env, session);
  }
  if (routeId === "admin.role-template.edit.form") {
    return requireManageUsers(session) ?? requireAdmin(session) ?? renderRoleTemplateEdit(env, session, params.key);
  }
  if (routeId === "admin.role-template.edit") {
    return requireManageUsers(session) ?? requireAdmin(session) ?? handleRoleTemplateUpdate(request, env, session, params.key);
  }
  if (routeId === "admin.role-template.apply") {
    return requireManageUsers(session) ?? requireAdmin(session) ?? handleRoleTemplateBulkApply(request, env, session, params.key);
  }

  if (routeId === "admin.search-report") return requireViewAudit(session) ?? handleAdminSearchReport(env, session);
  if (routeId === "admin.audit") return requireViewAudit(session) ?? handleSystemAudit(request, env, session);
  if (routeId === "admin.movements") return handleMovementHistory(request, env, session);
  if (routeId === "admin.data-quality") return handleDataQuality(request, env, session);

  if (routeId === "admin.user.permissions.form") {
    return requireManageUsers(session) ?? renderUserPermissions(env, session, params.id);
  }
  if (routeId === "admin.user.password-reset.form") {
    return requireManageUsers(session) ?? requireAdmin(session) ?? renderUserPasswordReset(env, session, params.id);
  }
  if (routeId === "admin.user.password-reset") {
    return requireManageUsers(session) ?? requireAdmin(session) ?? handleUserPasswordReset(request, env, session, params.id);
  }
  if (routeId === "admin.user.delete.form") {
    return requireManageUsers(session) ?? requireAdmin(session) ?? renderUserDelete(env, session, params.id);
  }
  if (routeId === "admin.user.delete") {
    return requireManageUsers(session) ?? requireAdmin(session) ?? handleUserDelete(request, env, session, params.id);
  }
  if (routeId === "admin.user.permissions") {
    return requireManageUsers(session) ?? handleUserPermissions(request, env, session, params.id);
  }
  if (routeId === "admin.user.disable" || routeId === "admin.user.enable") {
    const denied = requireManageUsers(session);
    if (denied) return denied;
    return handleUserStatusAction(env, session, params.id, routeId === "admin.user.disable" ? "disable" : "enable");
  }
  if (routeId === "admin.user.approve" || routeId === "admin.user.reject") {
    const denied = requireManageUsers(session);
    if (denied) return denied;
    return handleAdminUserAction(env, session, {
      id: params.id,
      action: routeId === "admin.user.approve" ? "approve" : "reject"
    });
  }

  if (resolved.descriptor.family === "documents") {
    return await routeDocumentRequest(request, env, session, url, resolved, effects) ?? notFoundPage(session);
  }
  if (resolved.descriptor.family === "snapshots") {
    if (routeId === "documents.snapshot.export") {
      return await routeDocumentRequest(request, env, session, url, resolved, effects) ?? notFoundPage(session);
    }
    return await routeWorkflowRequest(request, env, session, resolved, effects) ?? notFoundPage(session);
  }
  if (resolved.descriptor.family === "imports") {
    if (routeId === "documents.import.form") {
      return await routeDocumentRequest(request, env, session, url, resolved, effects) ?? notFoundPage(session);
    }
    return await routeWorkflowRequest(request, env, session, resolved, effects) ?? notFoundPage(session);
  }
  if (resolved.descriptor.family === "disposal") {
    return await routeWorkflowRequest(request, env, session, resolved, effects) ?? notFoundPage(session);
  }
  if (["sets", "racks", "masters"].includes(resolved.descriptor.family)) {
    return await routeMasterRequest(request, env, session, url, resolved) ?? notFoundPage(session);
  }

  return notFoundPage(session);
}
