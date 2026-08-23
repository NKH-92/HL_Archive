import { readBoolean } from "../../../shared/coercion.js";
import { escapeHtml } from "../../../ui/html/escape.js";
import { alertDanger, emptyState, page } from "../../../views/layout.js";

export function categoriesPage({ session, categories, values = {}, error = "" }) {
  const rows = [...categories].sort(compareCategoriesForManagement);
  const formValues = /** @type {Record<string, unknown>} */ (values);
  return page("대분류 관리", `
    <section class="page-head master-page-head">
      <div>
        <h1>대분류 관리</h1>
        <p>문서 등록·검색·폐기 조건에 사용하는 분류 이름을 관리합니다. 기존 문서의 분류는 사용중지해도 유지됩니다.</p>
      </div>
      <div class="master-head-guide" aria-label="이 화면의 필요한 기능">
        <strong>필요한 기능</strong>
        <span>찾기 · 추가 · 이름과 설명 수정 · 사용중지와 다시 사용</span>
      </div>
    </section>
    ${error ? alertDanger(error) : ""}
    <section class="panel master-create-panel" aria-labelledby="category-create-title">
      <div class="section-title master-section-title">
        <div>
          <h2 id="category-create-title">새 대분류 추가</h2>
          <p>업무에서 실제로 구분해 찾아야 하는 이름만 등록하세요.</p>
        </div>
      </div>
      <form method="post" action="/categories" class="master-create-form">
        <label><span>이름</span><input name="name" value="${escapeHtml(formValues.name || "")}" required placeholder="예: 품질관리"></label>
        <label><span>설명 <small>선택</small></span><input name="description" value="${escapeHtml(formValues.description || "")}" placeholder="어떤 문서를 묶는 분류인지 간단히 입력"></label>
        <button type="submit" class="primary">대분류 추가</button>
      </form>
    </section>
    <section class="panel master-management" data-master-management aria-labelledby="category-list-title">
      <div class="master-list-heading">
        <div>
          <h2 id="category-list-title">대분류 목록</h2>
          <p>이름순으로 표시합니다. 항목을 열면 이름과 설명을 수정할 수 있습니다.</p>
        </div>
        <div class="master-list-tools">
          <label class="master-search-field">
            <span>대분류 찾기</span>
            <input type="search" data-master-search placeholder="이름 또는 설명 검색" autocomplete="off">
          </label>
          <label class="master-inactive-toggle"><input type="checkbox" data-master-inactive-toggle> <span>사용중지 항목 포함</span></label>
        </div>
      </div>
      ${categoryList(rows)}
      <div class="empty-state master-filter-empty" data-master-filter-empty hidden aria-live="polite">
        <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
        <span>조건에 맞는 대분류가 없습니다.</span>
        <small>검색어를 지우거나 사용중지 항목 포함을 선택해 보세요.</small>
      </div>
    </section>
  `, session);
}

export function tagsPage({ session, tags, values = {}, error = "" }) {
  return masterPage({ session, title: "태그 관리", action: "/tags", rows: tags, values, error });
}

function masterPage({ session, title, action, rows, values, error }) {
  return page(title, `
    <section class="page-head"><h1>${escapeHtml(title)}</h1></section>
    <section class="panel narrow">
      ${error ? alertDanger(error) : ""}
      <form method="post" action="${action}" class="stack">
        <label>이름<input name="name" value="${escapeHtml(values.name || "")}" required></label>
        <label>설명<input name="description" value="${escapeHtml(values.description || "")}"></label>
        <button type="submit" class="primary">추가</button>
      </form>
    </section>
    <section class="panel">${masterList(rows)}</section>
  `, session);
}

function masterList(rows) {
  if (!rows.length) return emptyState("등록된 항목이 없습니다.");
  return `<div class="master-list">${rows.map(masterRow).join("")}</div>`;
}

function categoryList(rows) {
  if (!rows.length) return emptyState("등록된 대분류가 없습니다.");
  return `<div class="category-master-list" data-master-list>${rows.map(categoryRow).join("")}</div>`;
}

function categoryRow(row) {
  const active = readBoolean(row.is_active);
  const base = `/categories/${row.id}`;
  const name = escapeHtml(row.name);
  const description = escapeHtml(row.description || "");
  const searchText = escapeHtml(`${row.name || ""} ${row.description || ""}`);
  const version = escapeHtml(row.row_version ?? 0);
  const sortOrder = escapeHtml(row.sort_order ?? 0);
  return `
    <details class="category-master-item" data-master-row data-master-active="${active}" data-master-search-text="${searchText}">
      <summary class="category-master-summary">
        <span class="category-master-copy">
          <strong>${name}</strong>
          <small>${description || "설명 없음"}</small>
        </span>
        <span class="status ${active ? "master-active" : "master-inactive"}">${active ? "사용 중" : "사용중지"}</span>
        <span class="category-master-toggle">수정</span>
      </summary>
      <div class="category-master-edit">
        <form method="post" action="${base}/edit" class="category-master-edit-form">
          <input type="hidden" name="expectedRowVersion" value="${version}">
          <input type="hidden" name="sortOrder" value="${sortOrder}">
          ${active ? `<input type="hidden" name="isActive" value="1">` : ""}
          <label><span>이름</span><input name="name" value="${name}" required></label>
          <label><span>설명 <small>선택</small></span><input name="description" value="${description}" placeholder="어떤 문서를 묶는 분류인지 입력"></label>
          <button type="submit">변경 저장</button>
        </form>
        ${categoryStateAction({ active, base, name, description, sortOrder, version })}
      </div>
    </details>
  `;
}

function categoryStateAction({ active, base, name, description, sortOrder, version }) {
  if (active) {
    return `<div class="category-master-state-action">
      <p>사용중지하면 새 문서 등록 화면에서만 숨겨지며 기존 문서에는 그대로 남습니다.</p>
      <form method="post" action="${base}/delete" data-confirm="사용을 중지하시겠습니까? 신규 등록 화면에는 더 이상 표시되지 않습니다.">
        <input type="hidden" name="expectedRowVersion" value="${version}">
        <button type="submit" class="danger-button">사용 중지</button>
      </form>
    </div>`;
  }
  return `<div class="category-master-state-action">
    <p>다시 사용하면 새 문서 등록과 대분류 선택 목록에 표시됩니다.</p>
    <form method="post" action="${base}/edit">
      <input type="hidden" name="expectedRowVersion" value="${version}">
      <input type="hidden" name="name" value="${name}">
      <input type="hidden" name="description" value="${description}">
      <input type="hidden" name="sortOrder" value="${sortOrder}">
      <input type="hidden" name="isActive" value="1">
      <button type="submit">다시 사용</button>
    </form>
  </div>`;
}

function compareCategoriesForManagement(left, right) {
  const activeOrder = Number(readBoolean(right.is_active)) - Number(readBoolean(left.is_active));
  if (activeOrder) return activeOrder;
  return String(left.name || "").localeCompare(String(right.name || ""), "ko");
}

function masterRow(row) {
  const active = readBoolean(row.is_active);
  const base = `/tags/${row.id}`;
  return `
    <article class="master-row">
      <form method="post" action="${base}/edit" class="master-form">
        <input type="hidden" name="expectedRowVersion" value="${escapeHtml(row.row_version ?? 0)}">
        <input name="name" value="${escapeHtml(row.name)}" required>
        <input name="description" value="${escapeHtml(row.description || "")}" placeholder="설명">
        <label class="check-inline"><input type="checkbox" name="isActive" value="1" ${active ? "checked" : ""}> ${active ? "사용" : "다시 사용"}</label>
        <button type="submit">수정</button>
      </form>
      <form method="post" action="${base}/delete" data-confirm="사용을 중지하시겠습니까? 신규 등록 화면에는 더 이상 표시되지 않습니다.">
        <input type="hidden" name="expectedRowVersion" value="${escapeHtml(row.row_version ?? 0)}">
        <button type="submit" class="danger-button">사용중지</button>
      </form>
    </article>
  `;
}
