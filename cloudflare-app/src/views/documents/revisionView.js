import { documentLink } from "../../shared/documents/navigation.js";
import { locationLabel } from "../../domains/racks/index.js";
import { escapeHtml } from "../../ui/html/escape.js";
import { formatRevisionLabel } from "../../shared/documents/revision.js";
import { page } from "../layout.js";

export function documentRevisionPage({ session, document, values = {}, validation = null }) {
  const fieldErrors = validation?.fieldErrors || {};
  const formErrors = validation?.formErrors || [];
  const revisionNumber = values.revisionNumber || "";
  const revisionDate = values.revisionDate || "";

  return page("문서 개정", `
    <section class="page-head">
      <nav class="breadcrumb" aria-label="경로"><a href="${escapeHtml(documentLink(document.id, "", values.returnTo))}">문서 상세</a><span>/</span><span>문서 개정</span></nav>
      <h1>문서 개정</h1>
      <p>동일한 바인더에서 현재 개정본을 신규 개정본으로 교체합니다.</p>
    </section>

    <section class="document-form-layout revision-form-layout">
      <form method="post" action="/documents/${Number(document.id)}/revise" class="panel document-form" data-revision-form>
        ${errorSummary(fieldErrors, formErrors)}
        <input type="hidden" name="returnTo" value="${escapeHtml(values.returnTo || "")}">
        <input type="hidden" name="expectedUpdatedAt" value="${escapeHtml(values.expectedUpdatedAt ?? document.updated_at)}">
        <input type="hidden" name="expectedRowVersion" value="${Number(values.expectedRowVersion ?? document.row_version)}">

        <div class="alert warning revision-policy" role="note">
          <strong>동일 바인더 교체 전용</strong>
          <p>저장하면 현재 개정본은 자동으로 폐기되고, 같은 위치에 신규 개정본이 생성됩니다.</p>
          <p>다른 바인더에 보관할 문서라면 <a href="/documents/new?documentNumber=${encodeURIComponent(document.document_number)}">문서 등록</a>으로 등록하세요.</p>
        </div>

        <fieldset class="form-section">
          <legend>변경되지 않는 정보</legend>
          <dl class="revision-source-summary">
            <div><dt>문서번호</dt><dd class="mono">${escapeHtml(document.document_number)}</dd></div>
            <div><dt>문서명</dt><dd>${escapeHtml(document.document_name)}</dd></div>
            <div><dt>현재 개정</dt><dd>${escapeHtml(formatRevisionLabel(document.revision_number))} · ${escapeHtml(document.revision_date || "N/A")}</dd></div>
            <div><dt>보관 위치</dt><dd class="mono">${escapeHtml(locationLabel(document))}</dd></div>
          </dl>
        </fieldset>

        <fieldset class="form-section">
          <legend>신규 개정 정보</legend><p class="revision-change-summary"><strong>${escapeHtml(formatRevisionLabel(document.revision_number))}</strong> → <strong data-new-revision>${revisionNumber ? escapeHtml(formatRevisionLabel(revisionNumber)) : "신규 개정 입력"}</strong><span>이전본 자동 폐기 · 보관 위치 유지</span></p>
          <div class="form-grid two-column">
            ${field("revisionNumber", "새 개정번호", revisionNumber, fieldErrors, "text")}
            ${field("revisionDate", "새 제·개정일", revisionDate, fieldErrors, "date")}
          </div>
        </fieldset>

        <label class="check-item revision-confirm">
          <input type="checkbox" name="confirmReplacement" value="1" ${values.confirmReplacement === "1" ? "checked" : ""} required>
          <span>동일 바인더의 이전 개정본이 자동 폐기되는 것을 확인했습니다.</span>
        </label>

        <div class="form-actions">
          <a class="button secondary" href="${escapeHtml(documentLink(document.id, "", values.returnTo))}">취소</a>
          <button type="submit" class="danger-button">이전본 폐기 후 개정본으로 교체</button>
        </div>
      </form>
    </section>
    <script>(function () { var summary = document.querySelector('[data-error-summary]'); if (summary) summary.focus(); })();</script>
  `, session);
}

function field(name, label, value, errors, type) {
  const error = errors[name];
  return `<div class="field-group"><label for="field-${name}">${label} <em>*</em><input id="field-${name}" type="${type}" name="${name}" value="${escapeHtml(value)}" required ${error ? `aria-invalid="true" aria-describedby="error-${name}"` : ""}></label>${error ? `<p class="field-error" id="error-${name}">${escapeHtml(error)}</p>` : ""}</div>`;
}

function errorSummary(fieldErrors, formErrors) {
  const fields = Object.entries(fieldErrors);
  if (!fields.length && !formErrors.length) return "";
  return `<div class="form-error-summary" role="alert" tabindex="-1" data-error-summary><strong>문서를 개정하지 못했습니다.</strong><p>아래 ${fields.length + formErrors.length}개 항목을 확인하세요.</p><ul>${fields.map(([name, message]) => `<li><a href="#field-${escapeHtml(name)}">${escapeHtml(message)}</a></li>`).join("")}${formErrors.map((message) => `<li>${escapeHtml(message)}</li>`).join("")}</ul></div>`;
}
