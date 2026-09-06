import { documentLink, documentReturnTo } from "../shared/documents/navigation.js";
// 문서 위치 이동 라우트. 서버 권한 검사는 화면 버튼 노출과 별개로 항상 수행한다.

import {
  getDocument,
  getDocumentMovementPage,
  getDocumentMovements,
  moveDocument
} from "../domains/documents/index.js";
import { getSlotOptions } from "../domains/racks/index.js";
import { movementFormPage, movementsPage } from "../views/movementViews.js";
import { notFoundPage } from "../views/authViews.js";
import { redirect } from "../platform/http/responses.js";
import { logError } from "../platform/observability/logger.js";
import { clean } from "../shared/text/normalize.js";
import { requireAnyPermission, requireMoveDocuments } from "./permissionGuards.js";
import { PERMISSIONS } from "../permissions.js";

export async function renderDocumentMove(env, session, documentId, error = "", values = {}) {
  const denied = requireMoveDocuments(session);
  if (denied) return denied;

  const [document, slots, movements] = await Promise.all([
    getDocument(env, documentId),
    getSlotOptions(env),
    getDocumentMovements(env, documentId)
  ]);
  if (!document) return notFoundPage(session);

  return movementFormPage({ session, document, slots, movements, error, values });
}

export async function handleDocumentMove(request, env, session, documentId, effects = {}) {
  const denied = requireMoveDocuments(session);
  if (denied) return denied;

  const form = await request.formData();
  const values = {
    returnTo: documentReturnTo(form.get("returnTo")),
    rackSlotId: Number(form.get("rackSlotId")),
    rackFace: clean(form.get("rackFace")),
    reason: clean(form.get("reason")),
    expectedUpdatedAt: clean(form.get("expectedUpdatedAt")),
    expectedRowVersion: Number(form.get("expectedRowVersion"))
  };
  const result = await moveDocument(env, documentId, values, session);
  if (!result.ok) {
    return renderDocumentMove(env, session, documentId, result.message, values);
  }
  if (typeof effects.syncSearchDocument === "function") {
    try {
      await effects.syncSearchDocument(documentId);
    } catch (error) {
      // 이동은 이미 확정됐다. 검색 dirty 행은 Cron이 재처리하므로 사용자 작업은 성공으로 유지한다.
      logError("documents.move.search-index-immediate", error, { documentId });
    }
  }
  return redirect(documentLink(documentId, "", values.returnTo, "moved"));
}

export async function handleMovementHistory(request, env, session) {
  const denied = requireAnyPermission(session, [PERMISSIONS.MOVE_DOCUMENTS, PERMISSIONS.VIEW_AUDIT]);
  if (denied) return denied;

  const url = new URL(request.url);
  const query = clean(url.searchParams.get("q"));
  const page = Number(url.searchParams.get("page"));
  const result = await getDocumentMovementPage(env, { query }, page, 30);
  return movementsPage({ session, result, query });
}
