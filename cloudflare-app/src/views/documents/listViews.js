// 문서 목록과 소량 폐기 작업공간 화면.

import { escapeHtml } from "../../ui/html/escape.js";
import { FREE_TIER_BUDGET } from "../../config.js";
import { documentResults } from "../documentTableViews.js";
import { filterSelectRow, option, page } from "../layout.js";
import { didYouMeanView, parsedChipRow, searchInputBlock } from "../searchFragments.js";
import { bulkActionBar, disposalFeedback, documentToolbar, paginationView } from "./listFragments.js";
import { disposalListUrl } from "./urlHelpers.js";

export function documentsPage({
  session,
  query,
  parsedQuery = null,
  documents,
  categories = [],
  tags = [],
  filters = {},
  suggestions = [],
  didYouMean = [],
  pagination = { page: 1, pageSize: 30, totalDocuments: documents.length, totalPages: 1 }
}) {
  const chipRow = parsedChipRow(parsedQuery, query, "/documents");
  const activeFilterCount = [filters.categoryId, filters.tagId, filters.zoneNumber, filters.sort && filters.sort !== "updated"].filter(Boolean).length;
  return page("문서 관리", `
    <section class="page-head">
      <div><nav class="breadcrumb" aria-label="경로"><a href="/app">문서고</a><span>/</span><span>문서 관리</span></nav><h1>문서 관리</h1><p class="muted">문서 정보와 보관 위치를 확인하고 수정합니다.</p></div>
      ${documentToolbar(session)}
    </section>

    <button type="button" class="button secondary mobile-filter-toggle" data-filter-toggle aria-controls="document-advanced-filters" aria-expanded="${activeFilterCount ? "true" : "false"}">상세 필터${activeFilterCount ? ` ${activeFilterCount}개 적용` : ""}</button>
    <section id="document-advanced-filters" class="panel search-panel" data-collapsible-filters data-active="${activeFilterCount ? "true" : "false"}">
      <form method="get" action="/documents" class="filter-bar" id="documentFilterForm" data-search-form data-auto-submit>
        ${searchInputBlock(query, suggestions)}
        ${filterSelectRow({ categories, tags, filters })}
      </form>
    </section>

    ${chipRow ? `<section class="panel chip-panel">${chipRow}</section>` : ""}

    <section class="panel results-panel">
      <div class="section-title">
        <h2>${query ? `"${escapeHtml(query)}" 검색 결과` : "전체 보유문서"}</h2>
        <span class="count-badge">${pagination.totalDocuments === null ? `${documents.length}${pagination.hasMore ? "+" : ""}` : pagination.totalDocuments}건</span>
      </div>
      ${documentResults(documents, { emptyQuery: query, showScore: Boolean(query), query })}
      ${!documents.length && didYouMean.length ? didYouMeanView(didYouMean) : ""}
      ${paginationView(pagination, { query, filters })}
    </section>
  `, session);
}

export function disposalWorkspacePage({
  session,
  documents = [],
  categories = [],
  racks = [],
  years = [],
  filters = {},
  capped = false,
  directBulkDisposeLimit = FREE_TIER_BUDGET.directBulkDisposeMaxItems,
  history = [],
  campaigns = [],
  pagination = { page: 1, totalPages: 1, totalItems: 0 },
  tab = "active",
  feedback = null
}) {
  const targetCount = Number(pagination.totalItems || documents.length || 0);
  return page("폐기 관리", `
    <section class="page-head">
      <div><nav class="breadcrumb" aria-label="경로"><a href="/app">문서</a><span>/</span><span>폐기 관리</span></nav><h1>폐기 관리</h1><p class="muted">소량 문서는 개별 선택하고, 정기폐기는 필터 결과 전체를 한 캠페인으로 처리합니다.</p></div>
      <div class="button-group"><a class="button" href="/disposal-batches/new">정기폐기 시작</a></div>
    </section>
    ${tab === "active" ? `
      <section class="panel disposal-safety-panel" aria-label="폐기 작업 주의">
        <div><strong>폐기는 원본 단위로 처리됩니다.</strong><p>현재 조건에서 ${targetCount.toLocaleString("ko-KR")}건을 확인할 수 있습니다. 실제 원본과 정확한 건수·사유를 마지막으로 대조하세요.</p></div>
        <span class="status policy-required">복구 권한 필요</span>
      </section>
    ` : ""}
    ${disposalFeedback(feedback)}
    <nav class="workspace-tabs" aria-label="폐기 작업 화면">
      <a href="${escapeHtml(disposalListUrl(filters))}" ${tab === "active" ? `aria-current="page"` : ""}>진행 중</a>
      <a href="/documents/disposal?tab=history" ${tab === "history" ? `aria-current="page"` : ""}>캠페인 이력</a>
      <a href="/documents/disposal?tab=documents" ${tab === "documents" ? `aria-current="page"` : ""}>폐기 문서</a>
    </nav>
    ${tab === "history"
      ? disposalCampaignHistoryView(campaigns)
      : tab === "documents"
        ? disposalHistoryView(history, pagination, filters)
        : disposalTargetsView({ documents, categories, racks, years, filters, capped, limit: directBulkDisposeLimit })}
  `, session);
}

function disposalTargetsView({ documents, categories, racks, years, filters, capped, limit }) {
  const activeFilterCount = [filters.disposalDueYear, filters.categoryId, filters.rackId, filters.query].filter(Boolean).length;
  return `
    <div class="disposal-shell">
    <button type="button" class="button secondary mobile-filter-toggle disposal-filter-toggle" data-filter-toggle aria-controls="disposal-target-filters" aria-expanded="false"><i class="fa-solid fa-sliders" aria-hidden="true"></i>폐기 대상 필터${activeFilterCount ? ` ${activeFilterCount}개 적용` : ""}</button>
    <section id="disposal-target-filters" class="panel" data-collapsible-filters data-active="false">
      <form method="get" action="/documents/disposal" class="filter-bar disposal-filter">
        <label><span>폐기 예정 연도</span><select name="disposalDueYear"><option value="">전체</option>${years.map((year) => option(year, `${year}년`, filters.disposalDueYear)).join("")}</select></label>
        <label><span>대분류</span><select name="category"><option value="">전체</option>${categories.map((item) => option(item.id, item.name, filters.categoryId)).join("")}</select></label>
        <label><span>보관 위치</span><select name="rack"><option value="">전체</option>${racks.map((item) => option(item.id, `${item.zone_number}구역 ${item.rack_number}번 랙`, filters.rackId)).join("")}</select></label>
        <label class="search-input"><span>검색</span><input type="search" name="q" value="${escapeHtml(filters.query || "")}" placeholder="문서번호 또는 문서명"></label>
        <button type="submit" class="button">검색</button>
        <a class="button secondary" href="/documents/disposal">초기화</a>
      </form>
    </section>
    ${disposalFilterChips({ filters, categories, racks })}
    <section class="panel results-panel">
      <div class="section-title"><h2>폐기 대상</h2><span class="count-badge">${documents.length}${capped ? "+" : ""}건</span></div>
      ${capped ? `<div class="alert warning">선택 폐기는 한 번에 ${limit}건까지 처리하므로 앞의 ${limit}건만 표시됩니다. 조건에 맞는 문서 전체를 처리하려면 상단의 <a href="/disposal-batches/new">정기폐기</a>를 사용하세요.</div>` : ""}
      ${documentResults(documents, { bulk: true, selectAll: true, emptyMessage: "조건에 맞는 보관중 문서가 없습니다." })}
      ${bulkActionBar("/documents/disposal/process", filters, limit)}
    </section>
    </div>`;
}

function disposalFilterChips({ filters = {}, categories = [], racks = [] }) {
  const chips = [];
  const add = (key, label) => {
    const next = { ...filters, [key]: "" };
    chips.push(`<a class="chip active" href="${escapeHtml(disposalListUrl(next))}">${escapeHtml(label)} <span aria-hidden="true">×</span></a>`);
  };
  if (filters.query) add("query", `검색: ${filters.query}`);
  if (filters.disposalDueYear) add("disposalDueYear", `${filters.disposalDueYear}년`);
  if (filters.categoryId) {
    const category = categories.find((item) => Number(item.id) === Number(filters.categoryId));
    add("categoryId", `대분류: ${category?.name || filters.categoryId}`);
  }
  if (filters.rackId) {
    const rack = racks.find((item) => Number(item.id) === Number(filters.rackId));
    add("rackId", rack ? `${rack.zone_number}구역 ${rack.rack_number}번 랙` : `랙 ${filters.rackId}`);
  }
  return chips.length ? `<nav class="active-filter-chips disposal-filter-chips" aria-label="적용된 폐기 대상 필터">${chips.join("")}<a class="chip" href="/documents/disposal">전체 초기화</a></nav>` : "";
}

function disposalHistoryView(history, pagination, filters) {
  const rows = history.map((item) => `
    <tr class="is-disposed">
      <td data-label="문서명"><a href="/documents/${item.document_id}">${escapeHtml(item.document_name)}</a></td>
      <td class="mono-cell" data-label="문서번호">${escapeHtml(item.document_number)}</td>
      <td data-label="개정">${escapeHtml(item.revision_number)}</td>
      <td data-label="대분류">${escapeHtml(item.category_name || "-")}</td>
      <td class="location-cell" data-label="보관 위치">${escapeHtml(item.location_snapshot || "-")}</td>
      <td data-label="상태"><span class="status document-disposed">폐기</span></td>
      <td data-label="캠페인">${item.batch_code ? `<a class="mono" href="/disposal-batches/${item.disposal_batch_id}">${escapeHtml(item.batch_code)}</a>` : "-"}</td>
      <td data-label="폐기 사유">${escapeHtml(item.reason || "-")}</td>
      <td data-label="승인 참조">${escapeHtml(item.approval_reference || "-")}</td>
      <td data-label="처리">${escapeHtml(item.performed_by || "-")}<small>${escapeHtml(item.created_at || item.updated_at || "-")}</small></td>
    </tr>`).join("");
  const query = escapeHtml(filters.query || "");
  return `
    <section class="panel">
      <form method="get" action="/documents/disposal" class="filter-row">
        <input type="hidden" name="tab" value="documents">
        <label class="search-input"><span class="sr-only">폐기 문서 검색</span><input type="search" name="q" value="${query}" placeholder="문서명, 문서번호, 개정번호"></label>
        <button type="submit" class="button">검색</button>
        <a class="button secondary" href="/documents/disposal?tab=documents">초기화</a>
      </form>
    </section>
    <section class="panel results-panel">
      <div class="section-title"><h2>폐기 문서</h2><span class="count-badge">${pagination.totalItems || 0}건</span></div>
      <div class="table-wrap"><table class="doc-table disposal-history-table">
        <thead><tr><th>문서명</th><th>문서번호</th><th>개정</th><th>대분류</th><th>보관 위치</th><th>상태</th><th>캠페인</th><th>폐기 사유</th><th>승인 참조</th><th>처리</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="10" class="empty">현재 폐기 상태인 문서가 없습니다.</td></tr>`}</tbody>
      </table></div>
      ${historyPagination(pagination, filters.query)}
    </section>`;
}

function historyPagination(pagination, query) {
  if ((pagination.totalPages || 1) <= 1) return "";
  const url = (pageNumber) => {
    const params = new URLSearchParams({ tab: "documents", page: String(pageNumber) });
    if (query) params.set("q", query);
    return `/documents/disposal?${params}`;
  };
  return `<nav class="pagination" aria-label="폐기 문서 페이지">
    ${pagination.page <= 1 ? `<span class="button secondary sm disabled" aria-disabled="true">이전</span>` : `<a class="button secondary sm" href="${escapeHtml(url(pagination.page - 1))}">이전</a>`}
    <span>${pagination.page} / ${pagination.totalPages}</span>
    ${pagination.page >= pagination.totalPages ? `<span class="button secondary sm disabled" aria-disabled="true">다음</span>` : `<a class="button secondary sm" href="${escapeHtml(url(pagination.page + 1))}">다음</a>`}
  </nav>`;
}

function disposalCampaignHistoryView(campaigns) {
  const labels = {
    draft: "초안",
    frozen: "대상 확정",
    processing: "처리 중",
    completed: "완료",
    cancelled: "취소"
  };
  const rows = campaigns.map((batch) => `
    <tr>
      <td class="mono" data-label="캠페인 번호"><a href="/disposal-batches/${Number(batch.id)}">${escapeHtml(batch.batch_code)}</a></td>
      <td data-label="제목"><strong>${escapeHtml(batch.title)}</strong></td>
      <td data-label="상태"><span class="status ${batch.status === "completed" ? "campaign-completed" : batch.status === "cancelled" ? "campaign-cancelled" : "campaign-pending"}">${escapeHtml(labels[batch.status] || batch.status)}</span></td>
      <td data-label="폐기 사유">${escapeHtml(batch.disposal_reason || "-")}</td>
      <td data-label="승인 참조">${escapeHtml(batch.approval_reference || "-")}</td>
      <td data-label="대상 / 완료">${Number(batch.target_count || 0).toLocaleString("ko-KR")} / ${Number(batch.completed_count || 0).toLocaleString("ko-KR")}</td>
      <td data-label="담당 / 일시">${escapeHtml(batch.completed_by_name || batch.created_by_name || "-")}<small>${escapeHtml(batch.completed_at || batch.created_at || "-")}</small></td>
    </tr>`).join("");
  return `<section class="panel results-panel">
    <div class="section-title"><h2>캠페인 이력</h2><span class="count-badge">${campaigns.length}건</span></div>
    <div class="table-wrap"><table class="doc-table">
      <thead><tr><th>캠페인 번호</th><th>제목</th><th>상태</th><th>폐기 사유</th><th>승인 참조</th><th>대상 / 완료</th><th>담당 / 일시</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="7" class="empty">등록된 폐기 캠페인이 없습니다.</td></tr>`}</tbody>
    </table></div>
  </section>`;
}
