import { documentLink, documentReturnTo } from "../../shared/documents/navigation.js";
import {
  createDocument,
  disposeDocument,
  getDocumentMovements,
  getDocumentRevisionHistory,
  reviseDocument,
  restoreDocument,
  updateDocument
} from "../../domains/documents/index.js";
import { buildFloorPlanLayout, getFloorPlanRegions, getRackSummaries } from "../../domains/racks/index.js";
import {
  documentToFormValues,
  findDuplicateDocument,
  getDisposalLogs,
  getDocument,
  getDocumentAuditLogs,
  getDocumentTags,
  isDocumentCapacityError,
  loadDocumentFormOptions,
  validateDocumentInputDetails,
  valuesFromDocumentForm
} from "../../domains/documents/index.js";
import {
  documentDetailsPage,
  documentFormPage,
  documentRevisionPage
} from "../../views/documentViews.js";
import { accessDeniedPage, errorPage, notFoundPage } from "../../views/authViews.js";
import { hasPermission, hasReadPermission, PERMISSIONS } from "../../permissions.js";
import { jsonResponse, redirect } from "../../platform/http/responses.js";
import { logError } from "../../platform/observability/logger.js";
import { clean } from "../../shared/text/normalize.js";
import { requireManageDisposals, requireManageDocuments } from "../permissionGuards.js";

export async function renderCreateDocument(env, session, values = {}, validation = null, title = "문서 등록") {
  const { categories, tags, slots } = await loadDocumentFormOptions(env, { activeOnly: true });
  const safeValues = { ...values, returnTo: safeDocumentReturn(values.returnTo) };
  if (values.continuing) {
    safeValues.categoryId = values.retainCategory && categories.some((item) => Number(item.id) === Number(values.categoryId)) ? Number(values.categoryId) : "";
    const slot = values.retainLocation ? slots.find((item) => Number(item.id) === Number(values.rackSlotId)) : null;
    safeValues.rackSlotId = slot ? Number(slot.id) : "";
    safeValues.rackFace = slot && Number(slot.is_single_sided) !== 1 && values.rackFace === "B" ? "B" : "A";
  }

  return documentFormPage({
    session,
    title,
    action: "/documents",
    values: safeValues,
    categories,
    tags,
    slots,
    selectedTags: safeValues.tagIds || [],
    error: typeof validation === "string" ? validation : "",
    validation: typeof validation === "object" ? validation : null
  });
}

export async function handleDuplicateDocumentCheck(env, documentNumber, revisionNumber, excludeId = 0) {
  return jsonResponse(await findDuplicateDocument(env, documentNumber, revisionNumber, excludeId));
}

export async function handleCreateDocument(request, env, session, effects = {}) {
  const form = await request.formData();
  const values = valuesFromDocumentForm(form);
  values.returnTo = safeDocumentReturn(form.get("returnTo"));
  values.retainCategory = form.get("retainCategory") === "1";
  values.retainLocation = form.get("retainLocation") === "1";
  const validation = await validateDocumentInputDetails(env, values);

  if (!validation.ok) {
    return renderCreateDocument(env, session, values, validation);
  }

  const duplicate = await findDuplicateDocument(env, values.documentNumber, values.revisionNumber);
  if (duplicate.exists) return renderCreateDocument(env, session, values, duplicateValidation(duplicate));

  try {
    const id = await createDocument(env, values, session, session.role);
    if (typeof effects.syncSearchDocument === "function") {
      try {
        await effects.syncSearchDocument(id);
      } catch (error) {
        // Core 문서 등록은 확정된 상태다. 검색 갱신 실패는 outbox에 남겨 Cron이 재처리한다.
        logError("documents.search-index-immediate", error, { documentId: id });
      }
    }
    if (form.get("submitAction") === "saveAndNext") {
      const next = new URLSearchParams({ continuing: "1" });
      if (values.returnTo) next.set("returnTo", values.returnTo);
      if (values.retainCategory) { next.set("retainCategory", "1"); next.set("categoryId", String(values.categoryId)); }
      if (values.retainLocation) { next.set("retainLocation", "1"); next.set("rackSlotId", String(values.rackSlotId)); next.set("rackFace", values.rackFace); }
      return redirect(`/documents/new?${next}`);
    }
    return redirect(values.returnTo ? withToast(values.returnTo, "document-created") : `/documents/${id}?toast=created`);
  } catch (error) {
    if (isDocumentCapacityError(error)) {
      return renderCreateDocument(env, session, values, "문서 대장이 30,000건 기술 상한에 도달했습니다. 기존 문서를 제외하거나 운영 책임자에게 문의하세요.");
    }
    if (error?.code !== "DUPLICATE_DOCUMENT") throw error;
    const latestDuplicate = await findDuplicateDocument(env, values.documentNumber, values.revisionNumber);
    return renderCreateDocument(env, session, values, duplicateValidation(latestDuplicate));
  }
}

async function renderEditDocumentForm(env, session, id, values, selectedTags, validation = null) {
  const { categories, tags, slots } = await loadDocumentFormOptions(env, { includeSlots: false });
  return documentFormPage({
    session,
    title: "정보 수정",
    action: `/documents/${id}/edit`,
    values,
    categories,
    tags,
    slots,
    selectedTags,
    error: typeof validation === "string" ? validation : "",
    validation: typeof validation === "object" ? validation : null,
    showLocation: false,
    mode: "information"
  });
}

export async function handleDocumentRoute(request, env, session, routeInfo, effects = {}) {
  const { id, action } = routeInfo;
  const returnTo = documentReturnTo(new URL(request.url).searchParams.get("returnTo"));

  if (request.method === "GET" && action === "details") {
    // 404면 태그·이력·도면 조회를 건너 불필요한 D1 왕복을 막는다.
    const document = await getDocument(env, id);
    if (!document) {
      return notFoundPage(session);
    }

    const canViewAudit = hasReadPermission(session, PERMISSIONS.VIEW_AUDIT);
    const canViewMovements = canViewAudit || hasReadPermission(session, PERMISSIONS.MOVE_DOCUMENTS);
    const [tags, disposalLogs, auditLogs, movements, revisionHistory, racks, regions] = await Promise.all([
      getDocumentTags(env, id),
      getDisposalLogs(env, id),
      canViewAudit ? getDocumentAuditLogs(env, id) : Promise.resolve([]),
      canViewMovements ? getDocumentMovements(env, id) : Promise.resolve([]),
      getDocumentRevisionHistory(env, id),
      getRackSummaries(env),
      getFloorPlanRegions(env)
    ]);

    return documentDetailsPage({
      session,
      document,
      tags,
      disposalLogs,
      auditLogs,
      movements,
      revisionHistory,
      returnTo,
      floorPlan: buildFloorPlanLayout(racks, regions)
    });
  }

  if (request.method === "GET" && action === "edit") {
    const denied = requireManageDocuments(session);
    if (denied) {
      return denied;
    }

    const [document, tags] = await Promise.all([
      getDocument(env, id),
      getDocumentTags(env, id)
    ]);

    if (!document) {
      return notFoundPage(session);
    }

    if (document.status === "disposed") {
      return errorPage("폐기 상태 문서는 폐기를 해제하기 전까지 수정할 수 없습니다.", session, 400);
    }

    return renderEditDocumentForm(
      env,
      session,
      id,
      { ...documentToFormValues(document), returnTo },
      tags.map((tag) => tag.id)
    );
  }

  if (request.method === "GET" && action === "revise") {
    const denied = requireManageDocuments(session);
    if (denied) return denied;
    const document = await getDocument(env, id);
    if (!document) return notFoundPage(session);
    if (document.status !== "active") return errorPage("폐기 문서는 새 개정을 등록할 수 없습니다.", session, 400);

    return documentRevisionPage({
      session,
      document,
      values: {
        returnTo,
        revisionNumber: "",
        revisionDate: "",
        confirmReplacement: ""
      }
    });
  }

  if (request.method === "POST" && action === "revise") {
    const denied = requireManageDocuments(session);
    if (denied) return denied;
    const document = await getDocument(env, id);
    if (!document) return notFoundPage(session);

    const form = await request.formData();
    const values = {
      returnTo: documentReturnTo(form.get("returnTo")),
      revisionNumber: clean(form.get("revisionNumber")),
      revisionDate: clean(form.get("revisionDate")),
      confirmReplacement: clean(form.get("confirmReplacement")),
      expectedUpdatedAt: clean(form.get("expectedUpdatedAt")),
      expectedRowVersion: Number(form.get("expectedRowVersion"))
    };
    const result = await reviseDocument(env, id, values, session);
    if (result.ok) {
      if (typeof effects.syncSearchDocuments === "function") {
        try {
          await effects.syncSearchDocuments([id, result.newDocumentId]);
        } catch (error) {
          logError("documents.revision.search-index-immediate", error, {
            documentId: id,
            newDocumentId: result.newDocumentId
          });
        }
      }
      return redirect(documentLink(result.newDocumentId, "", values.returnTo, "revised"));
    }
    if (result.replacementId) return documentRevisionPage({ session, document, values, validation: { fieldErrors: {}, formErrors: ["이 문서는 이미 개정되었습니다. 최신 내용을 별도 확인하세요."] } });
    if (result.validation) {
      return documentRevisionPage({ session, document, values, validation: result.validation });
    }
    return documentRevisionPage({ session, document, values, validation: { fieldErrors: {}, formErrors: [result.message] } });
  }

  if (request.method === "POST" && action === "edit") {
    const denied = requireManageDocuments(session);
    if (denied) {
      return denied;
    }

    const [document, currentTags] = await Promise.all([
      getDocument(env, id),
      getDocumentTags(env, id)
    ]);
    if (!document) {
      return notFoundPage(session);
    }

    const form = await request.formData();
    const values = valuesFromDocumentForm(form);
    values.returnTo = documentReturnTo(form.get("returnTo"));
    // 일반정보 수정에서는 위치 입력을 받지 않는다. 기존 위치를 검증·저장 값에 다시
    // 결합해 위치 변경이 반드시 전용 이동 흐름을 거치도록 한다.
    values.rackSlotId = Number(document.rack_slot_id);
    values.rackFace = document.rack_face;
    values.revisionNumber = document.revision_number;
    values.revisionDate = document.revision_date || "";
    const validation = await validateDocumentInputDetails(env, values, {
      allowInactiveCategoryId: document.category_id,
      allowInactiveTagIds: currentTags.map((tag) => tag.id)
    });
    if (!document.revision_date) {
      delete validation.fieldErrors.revisionDate;
      validation.ok = !Object.keys(validation.fieldErrors).length && !validation.formErrors.length;
    }

    if (!validation.ok) {
      return renderEditDocumentForm(env, session, id, values, values.tagIds, validation);
    }

    const pairChanged = values.documentNumber.toUpperCase() !== String(document.document_number).toUpperCase();
    if (pairChanged) {
      const duplicate = await findDuplicateDocument(env, values.documentNumber, values.revisionNumber, id);
      if (duplicate.exists) return renderEditDocumentForm(env, session, id, values, values.tagIds, duplicateValidation(duplicate));
    }

    const result = await updateDocument(env, id, values, session, session.role);
    if (!result.ok) {
      return renderEditDocumentForm(env, session, id, values, values.tagIds, result.message);
    }
    await syncSearchDocumentBestEffort(effects, id, "documents.update.search-index-immediate");

    return redirect(documentLink(id, "", values.returnTo, "updated"));
  }

  if (request.method === "POST" && action === "dispose") {
    const denied = requireManageDisposals(session);
    if (denied) {
      return denied;
    }

    const form = await request.formData();
    const result = await disposeDocument(env, id, session, clean(form.get("reason")), session.role);
    if (!result.ok) {
      return errorPage(result.message, session, 400);
    }
    await syncSearchDocumentBestEffort(effects, id, "documents.dispose.search-index-immediate");
    return redirect(`/documents/${id}?toast=disposed`);
  }

  if (request.method === "POST" && action === "restore") {
    if (session.role !== "Admin") return accessDeniedPage(session);

    const form = await request.formData();
    const result = await restoreDocument(env, id, session, clean(form.get("reason")), session.role);
    if (!result.ok) {
      return errorPage(result.message, session, 400);
    }
    await syncSearchDocumentBestEffort(effects, id, "documents.restore.search-index-immediate");
    return redirect(`/documents/${id}?toast=restored`);
  }

  return notFoundPage(session);
}

async function syncSearchDocumentBestEffort(effects, documentId, event) {
  if (typeof effects.syncSearchDocument !== "function") return;
  try {
    await effects.syncSearchDocument(documentId);
  } catch (error) {
    // Core mutation은 이미 확정됐다. dirty 행을 남겨 Cron 복구가 가능하도록 검색 실패만 기록한다.
    logError(event, error, { documentId });
  }
}

function duplicateValidation(duplicate) {
  return {
    ok: false,
    fieldErrors: { documentNumber: "문서번호와 개정번호가 이미 등록되어 있습니다." },
    formErrors: [],
    duplicate: duplicate?.document ? duplicate : null
  };
}

function safeDocumentReturn(value) {
  const path = clean(value);
  return /^\/sets\/\d+$/.test(path) ? path : documentReturnTo(path);
}

function withToast(path, toast) {
  const url = new URL(path, "https://archive.local");
  url.searchParams.set("toast", toast);
  return `${url.pathname}${url.search}`;
}
