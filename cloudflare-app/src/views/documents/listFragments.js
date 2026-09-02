// 문서 목록과 폐기 작업공간이 공유하는 툴바·피드백·페이지 조각.

import { escapeHtml } from "../../ui/html/escape.js";
import { FREE_TIER_BUDGET } from "../../config.js";
import { hasReadPermission, PERMISSIONS } from "../../permissions.js";
import { alertDanger, alertWarning, paginationNav } from "../layout.js";
import { documentListUrl } from "./urlHelpers.js";

export function disposalFeedback(feedback) {
  if (!feedback?.message) return "";
  if (feedback.type === "warning") return alertWarning(feedback.message);
  if (feedback.type === "success") return `<div class="alert success disposal-complete" role="status">
    <strong>${escapeHtml(feedback.message)}</strong>
    <div class="disposal-complete-actions"><a class="button secondary sm" href="/documents/disposal?tab=documents">폐기 문서 보기</a><a class="button secondary sm" href="/app">문서로 이동</a></div>
  </div>`;
  return alertDanger(feedback.message);
}

export function paginationView(pagination, { query, filters }) {
  if (pagination.totalPages === null) {
    if (pagination.page <= 1 && !pagination.hasMore) return "";
    return paginationNav(pagination.page, null, {
      previousUrl: documentListUrl({ query, filters, page: Math.max(1, pagination.page - 1) }),
      nextUrl: documentListUrl({ query, filters, page: pagination.page + 1 }),
      hasMore: pagination.hasMore
    });
  }
  if (pagination.totalPages <= 1) return "";
  const previous = pagination.page > 1 ? pagination.page - 1 : 1;
  const next = pagination.page < pagination.totalPages ? pagination.page + 1 : pagination.totalPages;
  return paginationNav(pagination.page, pagination.totalPages, {
    previousUrl: documentListUrl({ query, filters, page: previous }),
    nextUrl: documentListUrl({ query, filters, page: next })
  });
}

export function bulkActionBar(action = "/documents/disposal/process", filters = {}, limit = FREE_TIER_BUDGET.directBulkDisposeMaxItems) {
  return `
    <div class="bulk-bar" data-bulk-bar hidden>
      <span data-bulk-count>원본 0부 선택</span>
      <span class="bulk-limit-notice" data-bulk-limit-notice role="status" hidden></span>
      <button type="button" class="danger-button sm" data-open-modal="disposal-review-modal" data-disposal-limit="${Number(limit)}">선택 수량 확인</button>
    </div>
    <dialog id="disposal-review-modal" class="modal disposal-review-modal" aria-labelledby="disposal-review-title">
      <form method="post" action="${escapeHtml(action)}" class="modal-body" data-bulk-form>
        <h2 id="disposal-review-title">실제 폐기 수량 확인</h2>
        <p class="muted">문서 한 건을 실제 원본 한 부로 계산합니다. 한 번에 최대 ${Number(limit)}건까지 처리하며, 아래 문서와 실제 폐기할 원본이 같은지 확인해 주세요.</p>
        <p class="disposal-count-confirmation" aria-live="polite">
          실제 폐기할 원본이 <strong data-bulk-confirm-count>0부</strong>가 맞습니까?
        </p>
        <ol class="disposal-review-list" data-bulk-summary></ol>
        <input type="hidden" name="ids" data-bulk-ids>
        <input type="hidden" name="confirmedTargetCount" value="0" data-bulk-confirm-count-input>
        <input type="hidden" name="q" value="${escapeHtml(filters.query || "")}">
        <input type="hidden" name="categoryId" value="${escapeHtml(filters.categoryId || "")}">
        <input type="hidden" name="rackId" value="${escapeHtml(filters.rackId || "")}">
        <input type="hidden" name="disposalDueYear" value="${escapeHtml(filters.disposalDueYear || "")}">
        <label>폐기 사유 <em>*</em><textarea name="reason" rows="3" required></textarea></label>
        <label>승인 문서 참조<input name="approvalReference" placeholder="결재 번호 또는 관련 문서번호"></label>
        <p class="danger-text">예를 누르면 선택한 원본은 즉시 폐기 상태로 변경되고 감사 이력에 기록됩니다.</p>
        <div class="modal-actions">
          <button type="button" class="button secondary" data-close-modal>취소</button>
          <button type="submit" class="danger-button" name="confirmDisposal" value="1" data-bulk-confirm-button disabled>예, 폐기합니다</button>
        </div>
      </form>
    </dialog>
  `;
}

export function documentToolbar(session) {
  const actions = [];
  if (hasReadPermission(session, PERMISSIONS.MANAGE_DOCUMENTS)) {
    actions.push(`<a class="button secondary" href="/documents/export.csv"><i class="fa-solid fa-download" aria-hidden="true"></i>CSV 내보내기</a>`);
    actions.push(`<a class="button secondary" href="/documents/import"><i class="fa-solid fa-file-excel" aria-hidden="true"></i>엑셀 대장 동기화</a>`);
    actions.push(`<a class="button action-button" href="/documents/new"><i class="fa-solid fa-plus" aria-hidden="true"></i>문서 등록</a>`);
  }
  return actions.length ? `<div class="button-group document-toolbar">${actions.join("")}</div>` : "";
}
