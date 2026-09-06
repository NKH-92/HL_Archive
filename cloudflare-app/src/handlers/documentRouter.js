// 문서 조회·등록·폐기·이동 라우트. routeRegistry가 해석한 route id와 params만 사용한다.
import { documentReturnTo } from "../shared/documents/navigation.js";
import { handleDocumentExport } from "./documents/browse.js";
import {
  handleCreateDocument,
  handleDuplicateDocumentCheck,
  handleDocumentRoute,
  renderCreateDocument
} from "./documents/crud.js";
import {
  handleBulkDispose,
  handleDisposalWorkspace,
  handleFilteredDispose,
  handleSelectedDisposal
} from "./documents/disposal.js";
import { handleDocumentSnapshotExport, renderDocumentSnapshotManager } from "./snapshotHandlers.js";
import { handleDocumentMove, renderDocumentMove } from "./movementHandlers.js";
import { requireManageDisposals, requireManageDocuments } from "./permissionGuards.js";
import { redirect } from "../platform/http/responses.js";

export async function routeDocumentRequest(request, env, session, url, resolved, effects = {}) {
  const routeId = resolved?.descriptor?.id || "";
  const params = resolved?.params || {};

  if (routeId === "documents.duplicate") {
    return requireManageDocuments(session) ?? handleDuplicateDocumentCheck(
      env,
      url.searchParams.get("documentNumber"),
      url.searchParams.get("revisionNumber"),
      url.searchParams.get("excludeId")
    );
  }

  if (routeId === "documents.list") return redirect(`/app${url.search}`);
  if (routeId === "documents.disposal") {
    return requireManageDisposals(session) ?? handleDisposalWorkspace(request, env, session);
  }
  if (routeId === "documents.bulk-dispose") {
    return requireManageDisposals(session) ?? handleBulkDispose(request, env, session);
  }
  if (routeId === "documents.disposal.process") {
    return requireManageDisposals(session) ?? handleSelectedDisposal(request, env, session);
  }
  if (routeId === "documents.dispose-filtered") {
    return requireManageDisposals(session) ?? handleFilteredDispose(request, env, session);
  }
  if (routeId === "documents.export") {
    return requireManageDocuments(session) ?? handleDocumentExport(env);
  }
  if (routeId === "documents.snapshot.export") return handleDocumentSnapshotExport(env, session);
  if (routeId === "documents.import.form") {
    return requireManageDocuments(session) ?? renderDocumentSnapshotManager(env, session);
  }
  if (routeId === "documents.new") {
    return requireManageDocuments(session) ?? renderCreateDocument(env, session, {
      documentNumber: url.searchParams.has("continuing") ? "" : url.searchParams.get("documentNumber") || "",
      continuing: url.searchParams.get("continuing") === "1",
      retainCategory: url.searchParams.get("retainCategory") === "1",
      retainLocation: url.searchParams.get("retainLocation") === "1",
      categoryId: url.searchParams.get("categoryId") || "",
      rackSlotId: url.searchParams.get("rackSlotId") || "",
      rackFace: url.searchParams.get("rackFace") || "A",
      returnTo: url.searchParams.get("returnTo") || ""
    });
  }
  if (routeId === "documents.create") {
    return requireManageDocuments(session) ?? handleCreateDocument(request, env, session, effects);
  }

  const documentId = Number(params.id);
  if (!Number.isInteger(documentId) || documentId < 1) return null;

  if (routeId === "documents.move.form") return renderDocumentMove(env, session, documentId, "", { returnTo: documentReturnTo(url.searchParams.get("returnTo")) });
  if (routeId === "documents.move") return handleDocumentMove(request, env, session, documentId, effects);

  const action = documentAction(routeId);
  if (!action) return null;
  return handleDocumentRoute(request, env, session, { id: documentId, action }, effects);
}

function documentAction(routeId) {
  if (routeId === "documents.details") return "details";
  if (routeId === "documents.edit.form" || routeId === "documents.edit") return "edit";
  if (routeId === "documents.revise.form" || routeId === "documents.revise") return "revise";
  if (routeId === "documents.dispose") return "dispose";
  if (routeId === "documents.restore") return "restore";
  return "";
}
