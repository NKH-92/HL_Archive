// 검색 뷰어(/app)·Q&A·검색 리포트 화면.

import { escapeHtml } from "../ui/html/escape.js";
import { FREE_TIER_BUDGET } from "../config.js";
import { safeEmbeddedJson } from "../platform/web/renderContext.js";
import { capabilitiesFromSession } from "../domains/identity/index.js";
import { searchCoreScript } from "./clientScript.js";
import { alertWarning, emptyResult, emptyState, filterSelectRow, listUrl, page, paginationNav, sectionHeader, statusBadge } from "./layout.js";
import {
  didYouMeanView,
  highlight,
  parsedChipRow,
  searchInputBlock
} from "./searchFragments.js";

export { didYouMeanView, highlight, parsedChipRow, searchInputBlock };

// 선택 폐기 한도는 서버 검증과 같은 예산 값을 쓴다(화면·서버 불일치 방지).
const DIRECT_BULK_DISPOSE_LIMIT = FREE_TIER_BUDGET.directBulkDisposeMaxItems;

export function dashboardPage({
  session,
  query,
  viewerSearch = { items: [], pagination: { totalItems: 0, totalPages: 1, page: 1, pageSize: 30 }, facets: {}, suggestions: [] },
  categories = [],
  tags = [],
  racks = [],
  filters = {},
  explicitFilters = {},
  parsedQuery = null,
  didYouMean = [],
  editableSets = [],
  selectedDocumentIds = [],
  mode = "results"
}) {
  const capabilities = capabilitiesFromSession(session);
  const uiFilters = Object.keys(explicitFilters || {}).length
    ? {
        ...explicitFilters,
        status: explicitFilters.status || filters.status,
        sort: explicitFilters.sort || filters.sort
      }
    : filters;
  const viewerContext = safeEmbeddedJson({
    categories: categories.map((item) => ({ id: Number(item.id), name: String(item.name || "") })),
    tags: tags.map((item) => ({ id: Number(item.id), name: String(item.name || "") })),
    racks: racks.map((item) => ({
      id: Number(item.id),
      code: String(item.code || ""),
      zoneNumber: Number(item.zone_number || 0),
      rackNumber: Number(item.rack_number || 0),
      isSingleSided: Number(item.is_single_sided || 0) === 1
    })),
    explicitFilters: filterUrlValues(uiFilters)
  });
  const documents = viewerSearch.items || [];
  const suggestions = viewerSearch.suggestions || [];
  const rawTotalItems = viewerSearch.pagination?.totalItems;
  const totalItems = rawTotalItems === null || rawTotalItems === undefined ? null : Number(rawTotalItems || 0);
  const shownItems = documents.length;
  const resultCountLabel = totalItems === null
    ? `${shownItems.toLocaleString("ko-KR")}${viewerSearch.pagination?.hasMore ? "+" : ""}건`
    : `${totalItems.toLocaleString("ko-KR")}건`;
  const resultStatusText = totalItems === null
    ? !shownItems
      ? "조건에 맞는 문서가 없습니다."
      : `${shownItems.toLocaleString("ko-KR")}건을 표시했습니다.${viewerSearch.pagination?.hasMore ? " 다음 결과가 더 있습니다." : ""}`
    : !totalItems
      ? "검색 결과가 없습니다."
      : shownItems < totalItems
        ? `${totalItems.toLocaleString("ko-KR")}건 중 ${shownItems.toLocaleString("ko-KR")}건을 표시했습니다.`
        : `${totalItems.toLocaleString("ko-KR")}건을 찾았습니다.`;

  // 홈 모드: 검색을 먼저 두되 서버가 기본 30행을 함께 제공한다.
  if (mode === "home") {
    return page("문서", `
      <section class="search-home" data-search-home>
        <section class="search-home-hero" aria-labelledby="viewer-title">
          <div class="search-home-copy">
            <h1 id="viewer-title">문서를 빠르게 찾으세요.</h1>
            <p class="search-home-sub">문서명, 문서번호, 대분류 또는 보관 위치를 입력하면 가장 가까운 결과부터 보여드립니다.</p>
          </div>
          ${viewerSearchForm({ query: "", suggestions: [], categories, tags, filters: uiFilters, home: true, showFilters: false, formId: "viewer-search-form" })}
        </section>
        ${viewerFilterControls({
          query: "",
          categories,
          tags,
          filters: uiFilters,
          statusText: totalItems === null
            ? shownItems
              ? `최근 등록·수정 문서 ${shownItems.toLocaleString("ko-KR")}건을 표시합니다.${viewerSearch.pagination?.hasMore ? " 다음 결과가 더 있습니다." : ""}`
              : "보관 중인 문서가 없습니다."
            : totalItems
              ? `보관 문서 ${totalItems.toLocaleString("ko-KR")}건 중 최근 등록·수정 ${shownItems.toLocaleString("ko-KR")}건을 표시합니다.`
              : "보관 중인 문서가 없습니다.",
          supplemental: `${parsedChipRow(null, "")}${activeFilterChips({ query: "", filters: uiFilters, categories, tags, racks })}<div data-home-extras>${homeQuickLinks(categories)}</div>`
        })}

        <section class="viewer-workspace is-home" data-viewer-app>
          <article class="panel results-panel" aria-labelledby="viewer-results-title" data-viewer-results aria-live="polite">
            <div class="section-title viewer-results-heading">
              <h2 id="viewer-results-title" data-results-title>최근 등록·수정 문서</h2>
              <div class="viewer-result-tools">
                ${columnSettings()}
                <span class="count-badge" data-results-count>${resultCountLabel}</span>
              </div>
            </div>
            <div data-results-body>
              ${viewerDocumentResults(documents, "", capabilities, selectedDocumentIds, false)}
              ${viewerPagination(viewerSearch.pagination, { query: "", filters })}
            </div>
          </article>
          ${workspacePreview()}
          ${workspaceBulkActions({ capabilities, editableSets, returnTo: "/app" })}
        </section>

      </section>
      ${mobileViewerFilterDialog({ query: "", categories, tags, filters: uiFilters })}
      <script type="application/json" data-viewer-context>${viewerContext}</script>
      ${searchCoreScript()}
    `, session);
  }

  // 검색 모드: 고정 열의 행 목록만 보여 주어 비교와 스캔을 우선한다.
  return page("문서", `
    <section class="search-band page-head search-workspace-head" aria-labelledby="viewer-title">
      <div>
        <h1 id="viewer-title">${query ? `“${escapeHtml(query)}” 검색 결과` : "문서"}</h1>
        <p class="page-sub">문서명과 문서번호를 함께 해석해 위치를 빠르게 비교합니다.</p>
      </div>
      ${viewerSearchForm({ query, suggestions, categories, tags, filters: uiFilters, showFilters: false, formId: "viewer-search-form" })}
    </section>
    ${viewerFilterControls({
      query,
      categories,
      tags,
      filters: uiFilters,
      statusText: resultStatusText,
      supplemental: `${parsedChipRow(parsedQuery, query)}${activeFilterChips({ query, filters: uiFilters, categories, tags, racks })}`
    })}

    <section class="viewer-workspace" data-viewer-app>
      <article class="panel results-panel" aria-labelledby="viewer-results-title" data-viewer-results aria-live="polite">
        <div class="section-title viewer-results-heading">
          <h2 id="viewer-results-title" data-results-title>${query ? `"${escapeHtml(query)}" 검색 결과` : hasExplicitViewerFilter(filters) ? "필터 검색 결과" : "최근 등록·수정 문서"}</h2>
          <div class="viewer-result-tools">
            ${columnSettings()}
            <span class="count-badge" data-results-count>${resultCountLabel}</span>
          </div>
        </div>
        <div data-results-body>
          ${viewerDocumentResults(documents, query, capabilities, selectedDocumentIds, true)}
          ${!documents.length && didYouMean.length ? didYouMeanView(didYouMean) : ""}
          ${viewerPagination(viewerSearch.pagination, { query, filters })}
        </div>
      </article>
      ${workspacePreview()}
      ${workspaceBulkActions({ capabilities, editableSets, returnTo: viewerUrl({ query, filters: uiFilters, page: viewerSearch.pagination?.page || 1 }) })}
    </section>
    ${mobileViewerFilterDialog({ query, categories, tags, filters: uiFilters })}
    <script type="application/json" data-viewer-context>${viewerContext}</script>
    ${searchCoreScript()}
  `, session);
}

function viewerSearchForm({ query, suggestions, categories, tags, filters, home = false, showFilters = true, formId = "" }) {
  const filterCount = activeViewerFilterCount(filters);
  return `
    <form method="get" action="/app"${formId ? ` id="${escapeHtml(formId)}"` : ""} class="viewer-search-form ${home ? "is-home" : ""}" data-search-form data-viewer-form>
      ${searchInputBlock(query, suggestions)}
      ${viewerLocationFilterInputs(filters)}
      ${showFilters ? `<details class="filter-details" open>
        <summary><i class="fa-solid fa-sliders"></i>상세 필터${filterCount ? `<span class="filter-count">${filterCount}</span>` : ""}</summary>
        ${filterSelectRow({ categories, tags, filters, viewer: true })}
      </details>` : ""}
    </form>
  `;
}

function viewerFilterControls({ query, categories, tags, filters, statusText, supplemental = "" }) {
  const resetHref = query ? `/app?q=${encodeURIComponent(query)}` : "/app";
  return `<section class="panel search-results-controls" aria-label="검색 조건" data-viewer-filter-controls>
    <div class="desktop-filter-controls"><details class="filter-details" open>
      <summary><i class="fa-solid fa-sliders" aria-hidden="true"></i>상세 필터${activeFilterBadge(filters)}</summary>
      ${filterSelectRow({ categories, tags, filters, viewer: true, formId: "viewer-search-form", resetHref })}
    </details></div>
    <button type="button" class="button secondary mobile-search-filter-button" data-open-modal="viewer-filter-dialog"><i class="fa-solid fa-sliders" aria-hidden="true"></i>검색 필터${activeFilterBadge(filters)}</button>
    <p class="search-live-status" data-search-live aria-live="polite">${statusText}</p>
    ${supplemental}
  </section>`;
}

function activeViewerFilterCount(filters = {}) {
  return [
    filters.categoryId,
    filters.tagId,
    filters.zoneNumber,
    filters.rackId,
    filters.rackFace,
    filters.columnNumber,
    filters.shelfNumber
  ].filter(Boolean).length;
}

function hasExplicitViewerFilter(filters = {}) {
  return activeViewerFilterCount(filters) > 0 || Boolean(filters.sort && filters.sort !== "relevance");
}

function activeFilterBadge(filters = {}) {
  const count = activeViewerFilterCount(filters);
  return `<span class="filter-count" data-viewer-filter-count${count ? "" : " hidden"}>${count}</span>`;
}

function mobileViewerFilterDialog({ query, categories, tags, filters }) {
  const resetHref = query ? `/app?q=${encodeURIComponent(query)}` : "/app";
  return `<dialog id="viewer-filter-dialog" class="mobile-filter-dialog" aria-labelledby="viewer-filter-dialog-title">
    <form method="get" action="/app" class="mobile-filter-form" data-mobile-viewer-filter>
      <div class="mobile-filter-head"><div><small>문서 검색</small><h2 id="viewer-filter-dialog-title">상세 필터</h2></div><button type="button" class="icon-button" data-close-modal aria-label="필터 닫기">×</button></div>
      <input type="hidden" name="q" value="${escapeHtml(query)}">
      ${viewerLocationFilterInputs(filters)}
      ${filterSelectRow({ categories, tags, filters, viewer: true, showReset: false })}
      <div class="mobile-filter-actions"><a class="button secondary" href="${resetHref}" data-viewer-filter-reset>필터 초기화</a><button type="submit" class="button action-button">결과 보기</button></div>
    </form>
  </dialog>`;
}

function viewerLocationFilterInputs(filters = {}) {
  return [
    ["rack", filters.rackId],
    ["face", filters.rackFace],
    ["column", filters.columnNumber],
    ["shelf", filters.shelfNumber]
  ].filter(([name, value]) => name === "face"
    ? value === "A" || value === "B"
    : Number.isInteger(Number(value)) && Number(value) > 0)
    .map(([name, value]) => `<input type="hidden" name="${name}" value="${escapeHtml(String(value))}">`)
    .join("");
}

function homeQuickLinks(categories = []) {
  const categoryLinks = categories.slice(0, 6).map((category) =>
    `<a class="chip" href="/app?category=${Number(category.id)}" data-viewer-set-filter="category" data-viewer-filter-value="${Number(category.id)}">${escapeHtml(category.name)}</a>`
  ).join("");
  if (!categoryLinks) return "";
  return `<nav class="search-home-filter quick-filter-row" aria-label="빠른 분류"><span>빠른 분류</span>${categoryLinks}</nav>`;
}

function viewerDocumentResults(documents, query, capabilities = {}, selectedDocumentIds = [], showReset = false) {
  if (!documents.length) {
    return emptyResult("조건에 맞는 문서가 없습니다.", showReset ? "reset" : "");
  }
  const selectable = capabilities.canManageSets || capabilities.canManageDisposals;
  const selected = new Set(selectedDocumentIds.map(Number));
  return `<div class="viewer-result-table ${selectable ? "is-selectable" : ""}" role="grid" aria-label="문서 검색 결과">
    <div class="viewer-result-header" role="row">${selectable ? `<span class="check-col" role="columnheader"><span class="sr-only">선택</span></span>` : ""}<span role="columnheader">문서명</span><span role="columnheader">문서번호 · 개정</span><span role="columnheader">대분류</span><span role="columnheader">보관 위치</span><span role="columnheader">상태</span><span class="optional-column" data-column="revision-date" role="columnheader" hidden>제·개정일</span></div>
    <div class="viewer-result-list" role="rowgroup">${documents.map((document) => viewerDocumentCard(document, query, selectable, selected.has(Number(document.id)))).join("")}</div>
  </div>`;
}

function viewerDocumentCard(document, query = "", selectable = false, selected = false) {
  const location = document.location || {};
  const locationText = location.label || "위치 미지정";
  return `
    <article class="viewer-result-row ${selectable ? "is-selectable" : ""} ${document.status !== "active" ? "is-disposed" : ""}" role="row" tabindex="0" aria-selected="false" data-document-row data-document-url="/documents/${document.id}" data-document-name="${escapeHtml(document.documentName || "문서명 없음")}" data-document-number="${escapeHtml(document.documentNumber || "")}" data-document-revision="${escapeHtml(document.revisionLabel || document.revisionNumber || "N/A")}" data-document-category="${escapeHtml(document.categoryName || "-")}" data-document-location="${escapeHtml(locationText)}" data-document-status="${document.status === "active" ? "보관중" : "폐기"}">
      ${selectable ? `<span class="check-col" role="cell" data-label="선택"><label class="bulk-check-target"><input type="checkbox" value="${Number(document.id)}" data-bulk-item aria-label="${escapeHtml(document.documentName || document.documentNumber)} 선택"${selected ? " checked" : ""}></label></span>` : ""}
      <span class="viewer-result-name" role="cell" data-label="문서명"><a href="/documents/${document.id}" data-doc-click="${document.id}">${highlight(document.documentName || "문서명 없음", query)}</a></span>
      <span class="mono" role="cell" data-label="문서번호/개정"><span class="viewer-result-value">${highlight(document.documentNumber, query)} <small>${escapeHtml(document.revisionLabel || document.revisionNumber || "N/A")}</small></span></span>
      <span class="viewer-result-detail-only" role="cell" data-label="대분류">${escapeHtml(document.categoryName || "-")}</span>
      <span class="viewer-result-location viewer-result-detail-only" role="cell" data-label="보관 위치">${escapeHtml(locationText)}</span>
      <span class="viewer-result-detail-only" role="cell" data-label="상태">${statusBadge(document.status)}</span>
      <span class="optional-column viewer-result-detail-only" data-column="revision-date" role="cell" data-label="제·개정일" hidden>${escapeHtml(document.revisionDate || "-")}</span>
    </article>
  `;
}

function columnSettings() {
  return `<details class="column-settings"><summary><i class="fa-solid fa-table-columns" aria-hidden="true"></i>열 설정</summary><label><input type="checkbox" data-column-toggle="revision-date"> 제·개정일</label></details>`;
}

function workspacePreview() {
  return `<aside class="panel viewer-preview" data-document-preview hidden aria-live="polite">
    <div class="section-title"><h2>빠른 미리보기</h2><button type="button" class="icon-button" data-preview-close aria-label="미리보기 닫기">×</button></div>
    <strong data-preview-name></strong>
    <p class="mono" data-preview-number></p>
    <dl><div><dt>대분류</dt><dd data-preview-category></dd></div><div><dt>보관 위치</dt><dd data-preview-location></dd></div><div><dt>상태</dt><dd data-preview-status></dd></div></dl>
    <a class="button" href="/app" data-preview-link>문서 상세 열기</a>
  </aside>`;
}

function workspaceBulkActions({ capabilities, editableSets = [], returnTo }) {
  if (!capabilities.canManageSets && !capabilities.canManageDisposals) return "";
  const setForm = capabilities.canManageSets && editableSets.length ? `<form method="post" action="/sets/0/add" class="workspace-set-form" data-set-selection-form>
    <label><span class="sr-only">추가할 준비 문서 세트</span><select name="setTarget" required data-set-target><option value="">세트 선택</option>${editableSets.map((set) => `<option value="${Number(set.id)}" data-version="${Number(set.row_version || 0)}">${escapeHtml(set.name)}</option>`).join("")}</select></label>
    <input type="hidden" name="documentIds" data-bulk-ids>
    <input type="hidden" name="expectedRowVersion" data-set-version>
    <input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}" data-workspace-return-to>
    <button type="submit" class="button secondary sm">세트에 추가</button>
  </form>` : "";
  const disposalButton = capabilities.canManageDisposals
    ? `<button type="button" class="danger-button sm" data-open-modal="workspace-disposal-modal" data-disposal-limit="${DIRECT_BULK_DISPOSE_LIMIT}">선택 문서 폐기</button>`
    : "";
  const disposalDialog = capabilities.canManageDisposals ? `<dialog id="workspace-disposal-modal" class="modal disposal-review-modal" aria-labelledby="workspace-disposal-title">
    <form method="post" action="/documents/disposal/process" class="modal-body" data-bulk-form>
      <h2 id="workspace-disposal-title">선택 문서 폐기</h2>
      <p>한 번에 최대 ${DIRECT_BULK_DISPOSE_LIMIT}건을 처리합니다. 실제 원본과 선택 수량이 같은지 확인하세요.</p>
      <p>실제 폐기할 원본이 <strong data-bulk-confirm-count>0부</strong>가 맞습니까?</p>
      <ol class="disposal-review-list" data-bulk-summary></ol>
      <input type="hidden" name="ids" data-bulk-ids>
      <input type="hidden" name="confirmedTargetCount" value="0" data-bulk-confirm-count-input>
      <input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}" data-workspace-return-to>
      <label>폐기 사유 <em>*</em><textarea name="reason" rows="3" required></textarea></label>
      <label>승인 문서 참조<input name="approvalReference"></label>
      <div class="modal-actions"><button type="button" class="button secondary" data-close-modal>취소</button><button type="submit" class="danger-button" name="confirmDisposal" value="1" data-bulk-confirm-button disabled>예, 폐기합니다</button></div>
    </form>
  </dialog>` : "";
  return `<div class="bulk-bar workspace-bulk-bar" data-bulk-bar data-document-selection hidden><span data-bulk-count>0건 선택</span><span class="bulk-limit-notice" data-bulk-limit-notice role="status" hidden></span>${setForm}${disposalButton}</div>${disposalDialog}`;
}

function activeFilterChips({ query, filters = {}, categories = [], tags = [], racks = [] }) {
  const chips = [];
  const add = (name, label, patch) => chips.push(`<a class="chip active" href="${viewerUrl({ query, filters, patch })}" data-viewer-clear-filter="${name}">${escapeHtml(label)} <span aria-hidden="true">×</span></a>`);
  if (filters.categoryId) add("category", categories.find((item) => Number(item.id) === Number(filters.categoryId))?.name || "대분류", { categoryId: 0 });
  if (filters.tagId) add("tag", tags.find((item) => Number(item.id) === Number(filters.tagId))?.name || "태그", { tagId: 0 });
  if (filters.zoneNumber) add("zone", `${filters.zoneNumber}구역`, { zoneNumber: 0 });
  if (filters.rackId) {
    const rack = racks.find((item) => Number(item.id) === Number(filters.rackId));
    add("rack", rack?.code ? `랙 ${rack.code}` : `랙 ${filters.rackId}`, { rackId: 0, rackFace: "", columnNumber: 0, shelfNumber: 0 });
  }
  if (filters.rackFace) {
    const rack = racks.find((item) => Number(item.id) === Number(filters.rackId));
    add("face", rack?.is_single_sided || rack?.isSingleSided ? "단면" : filters.rackFace === "B" ? "2면" : "1면", { rackFace: "" });
  }
  if (filters.columnNumber) add("column", `${filters.columnNumber}열`, { columnNumber: 0 });
  if (filters.shelfNumber) add("shelf", `${filters.shelfNumber}선반`, { shelfNumber: 0 });
  if (filters.status && filters.status !== "active") add("status", filters.status === "disposed" ? "폐기" : "전체 상태", { status: "active" });
  return `<div data-active-filter-chips>${chips.length ? `<nav class="active-filter-chips" aria-label="적용된 필터">${chips.join("")}</nav>` : ""}</div>`;
}

function filterUrlValues(filters = {}) {
  return {
    category: Number(filters.categoryId || 0),
    tag: Number(filters.tagId || 0),
    zone: Number(filters.zoneNumber || 0),
    rack: Number(filters.rackId || 0),
    face: String(filters.rackFace || ""),
    column: Number(filters.columnNumber || 0),
    shelf: Number(filters.shelfNumber || 0),
    status: String(filters.status || ""),
    sort: String(filters.sort || "")
  };
}

function viewerPagination(pagination = {}, { query, filters }) {
  if (pagination.totalPages === null) {
    const page = Number(pagination.page || 1);
    if (page <= 1 && !pagination.hasMore) return "";
    return paginationNav(page, null, {
      previousUrl: viewerUrl({ query, filters, page: Math.max(1, page - 1) }),
      nextUrl: viewerUrl({ query, filters, page: page + 1 }),
      hasMore: pagination.hasMore
    });
  }
  const totalPages = Number(pagination.totalPages || 1);
  if (totalPages <= 1) return "";
  const page = Number(pagination.page || 1);
  return paginationNav(page, totalPages, {
    previousUrl: viewerUrl({ query, filters, page: Math.max(1, page - 1) }),
    nextUrl: viewerUrl({ query, filters, page: Math.min(totalPages, page + 1) })
  });
}

function viewerUrl({ query, filters = {}, patch = {}, page = 1 }) {
  return listUrl("/app", { query, filters: { ...filters, ...patch }, page }, [
    ["category", "categoryId"],
    ["tag", "tagId"],
    ["zone", "zoneNumber"],
    ["rack", "rackId"],
    ["face", "rackFace"],
    ["column", "columnNumber"],
    ["shelf", "shelfNumber"],
    ["status", "status"],
    ["sort", "sort"]
  ]);
}

export function qaPage({ session, support = {} }) {
  const contactName = [support.department, support.name].filter(Boolean).join(" / ");
  const contactEmail = support.email || "";
  const capabilities = capabilitiesFromSession(session);
  const tasks = [
    ["/app", "fa-magnifying-glass", "문서 찾기", "문서번호·문서명·보관 위치로 검색합니다."],
    ["/floor-plan", "fa-location-dot", "보관 위치 확인", "구역과 랙 배치를 도면에서 확인합니다."]
  ];
  if (capabilities.canManageDocuments) {
    tasks.push(["/documents/new", "fa-file-circle-plus", "문서 등록", "문서 정보와 보관 위치를 입력합니다."]);
    tasks.push(["/documents/import", "fa-file-excel", "엑셀 대장 동기화", "최신 대장을 검증한 뒤 변경 사항을 반영합니다."]);
  }
  if (capabilities.canManageDisposals) {
    tasks.push(["/documents/disposal", "fa-box-archive", "문서 폐기", "폐기 대상을 필터링하고 선택해 처리합니다."]);
  }
  if (capabilities.canOpenManagement) {
    tasks.push(["/admin", "fa-list-check", "확인할 일", "운영 중 확인이 필요한 항목을 점검합니다."]);
  }
  return page("도움말·문의", `
    <section class="page-head">
      <div><h1>도움말·문의</h1><p class="muted">하려는 작업을 선택하거나 검색 방법을 확인하세요.</p></div>
      ${contactEmail ? `<a class="button secondary" href="mailto:${escapeHtml(contactEmail)}">담당자 문의</a>` : ""}
    </section>
    <section class="panel help-task-panel" aria-labelledby="help-task-title">
      <div class="section-title"><h2 id="help-task-title">무엇을 하시나요?</h2><span class="count-badge">${tasks.length}개 작업</span></div>
      <nav class="help-task-grid" aria-label="주요 작업 바로가기">
        ${tasks.map(([href, icon, label, description]) => `<a class="help-task-card" href="${href}"><i class="fa-solid ${icon}" aria-hidden="true"></i><span><strong>${label}</strong><small>${description}</small></span><span class="help-task-arrow" aria-hidden="true">›</span></a>`).join("")}
      </nav>
    </section>
    <section class="content-grid">
      <article class="panel">
        <h2>검색 방법</h2>
        <ul class="manual-list">
          <li><strong>문서번호 일부</strong><span>예: PV-2026 대신 2026 또는 PV만 입력해도 검색합니다.</span></li>
          <li><strong>문서명 키워드</strong><span>띄어쓰기와 일부 오타를 허용해 유사한 문서를 우선 보여줍니다.</span></li>
          <li><strong>위치 검색</strong><span>1구역, 2번 랙, 1-01처럼 보관 위치 단서로도 찾을 수 있습니다.</span></li>
        </ul>
      </article>
      <article class="panel">
        <h2>담당자</h2>
        <dl class="contact-list">
          <div><dt>부서 / 이름</dt><dd>${escapeHtml(contactName || "운영 관리자에게 문의하세요.")}</dd></div>
          ${contactEmail ? `<div><dt>이메일</dt><dd><a href="mailto:${escapeHtml(contactEmail)}">${escapeHtml(contactEmail)}</a></dd></div>` : ""}
        </dl>
      </article>
    </section>
  `, session);
}

// 관리자 검색 리포트: 자주 찾는 검색어와 실패 검색어로 태그·문서명을 보강한다.
export function searchReportPage({ session, report }) {
  const { topQueries = [], failedQueries = [], topDocuments = [] } = report || {};
  return page("검색 리포트", `
    <section class="page-head">
      <h1>검색 리포트</h1>
      <a class="button secondary" href="/admin">관리자 홈</a>
    </section>
    ${report?.unavailable ? alertWarning("검색 로그 테이블이 아직 없습니다. 0014_search_analytics 마이그레이션을 적용하면 집계가 시작됩니다.") : ""}
    <section class="content-grid">
      <article class="panel">
        ${sectionHeader("자주 찾는 검색어", `${topQueries.length}건`)}
        ${topQueries.length ? `
        <div class="table-wrap"><table>
          <thead><tr><th>검색어</th><th>횟수</th><th>최근 결과</th><th>마지막 검색</th></tr></thead>
          <tbody>${topQueries.map((row) => `
            <tr>
              <td><a href="/app?q=${encodeURIComponent(row.query_text)}">${escapeHtml(row.query_text)}</a></td>
              <td>${Number(row.hits || 0)}회</td>
              <td>${Number(row.last_result_count || 0)}건</td>
              <td>${escapeHtml(row.last_searched_at || "-")}</td>
            </tr>
          `).join("")}</tbody>
        </table></div>` : emptyState("아직 집계된 검색어가 없습니다.")}
      </article>
      <article class="panel">
        ${sectionHeader("결과 없는 검색어", `${failedQueries.length}건`)}
        <p class="muted">자주 실패하는 표현은 해당 문서의 태그나 문서명에 추가하면 다음 검색부터 찾을 수 있습니다.</p>
        ${failedQueries.length ? `
        <div class="table-wrap"><table>
          <thead><tr><th>검색어</th><th>시도</th><th>마지막 검색</th><th></th></tr></thead>
          <tbody>${failedQueries.map((row) => `
            <tr>
              <td>${escapeHtml(row.query_text)}</td>
              <td>${Number(row.hits || 0)}회</td>
              <td>${escapeHtml(row.last_searched_at || "-")}</td>
              <td><a class="button secondary sm" href="/tags?name=${encodeURIComponent(row.query_text)}">태그 보강</a></td>
            </tr>
          `).join("")}</tbody>
        </table></div>` : emptyState("실패한 검색이 없습니다.")}
      </article>
    </section>
    <section class="panel">
      ${sectionHeader("많이 찾는 문서", `${topDocuments.length}건`)}
      ${topDocuments.length ? `
      <div class="index-list">
        ${topDocuments.map((row) => `
          <a class="index-row" href="/documents/${row.id}">
            <span><span class="mono">${escapeHtml(row.document_number)}</span> ${escapeHtml(row.document_name)}</span>
            <strong>${Number(row.click_count || 0)}회</strong>
          </a>
        `).join("")}
      </div>` : emptyState("아직 클릭 집계가 없습니다.")}
    </section>
  `, session);
}
