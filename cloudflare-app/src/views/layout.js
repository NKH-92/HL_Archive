// 페이지 골격(page)과 여러 화면이 공유하는 범용 프래그먼트.

import { escapeHtml } from "../ui/html/escape.js";
import { capabilitiesFromSession } from "../domains/identity/index.js";
import { secureHtmlDocument } from "../platform/web/htmlSecurity.js";
import { createRenderContext } from "../platform/web/renderContext.js";
import { htmlContentSecurityPolicy } from "../security.js";

export function page(title, body, session, status = 200) {
  // 요청별 CSP nonce. 인라인 <script>/<style>에 주입하고 응답 헤더의 script-src와 짝을 맞춘다.
  const renderContext = createRenderContext(session);
  const nonce = renderContext.nonce;

  // CSRF는 헤더 로그아웃 폼까지 포함해 전체 HTML의 POST form에 주입한다.
  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} - 한림문서고</title>
  <meta name="description" content="한림문서고 문서 검색 및 보관 위치 안내 시스템">
  <link rel="icon" type="image/svg+xml" href="/images/hanlim-pharm-logo.svg">
  ${session?.csrfToken ? `<meta name="csrf-token" content="${escapeHtml(session.csrfToken)}">` : ""}
  <link rel="stylesheet" href="/assets/app.css">
  <script nonce="${nonce}" src="/assets/app.js" defer></script>
</head>
<body>
  <a href="#main-content" class="skip-nav">본문 바로가기</a>
  ${session ? header(session) : ""}
  <main id="main-content" class="${session ? "app-shell" : "login-main"}">${body}</main>
</body>
</html>`;

  const securedHtml = secureHtmlDocument(html, renderContext);

  return new Response(securedHtml, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": htmlContentSecurityPolicy(nonce)
    }
  });
}


// 인라인 <script>/<style> 태그에 CSP nonce를 주입한다. 본문의 사용자 값은 모두 escapeHtml로
// "<"가 이스케이프되므로 실제 스크립트/스타일 태그에만 매칭된다.

function header(session) {
  const capabilities = capabilitiesFromSession(session);
  /** @type {Array<[string, string, string]>} */
  const documentLinks = [
    ["/app", "fa-magnifying-glass", "문서 검색"],
    ["/floor-plan", "fa-location-dot", "보관 위치"]
  ];
  const workLinks = [];
  if (capabilities.canManageDocuments) {
    workLinks.push(["/documents/import", "fa-file-excel", "엑셀 대장 동기화"]);
  }
  if (capabilities.canManageDisposals) {
    workLinks.push(["/documents/disposal", "fa-box-archive", "문서 폐기"]);
    workLinks.push(["/documents/disposal?tab=documents", "fa-box-archive", "폐기 문서"]);
  }
  if (capabilities.canManageDocuments) {
    workLinks.push(["/documents/new", "fa-file-circle-plus", "문서 등록"]);
  }

  const masterLinks = [];
  if (capabilities.canManageMasters) {
    masterLinks.push(["/racks", "fa-table-cells-large", "랙·보관 위치"]);
    masterLinks.push(["/categories", "fa-list-check", "대분류"]);
    masterLinks.push(["/tags", "fa-tags", "태그"]);
  }
  const operationLinks = [];
  if (capabilities.canOpenManagement) {
    operationLinks.push(["/admin", "fa-list-check", "확인할 일"]);
  }
  if (capabilities.canManageUsers) {
    operationLinks.push(["/admin/settings", "fa-users-gear", "사용자·권한"]);
  }
  const evidenceLinks = [];
  if (capabilities.canViewAudit) {
    evidenceLinks.push(["/admin/audit", "fa-clock-rotate-left", "감사 이력"]);
  }
  if (capabilities.canViewMovements) {
    evidenceLinks.push(["/admin/movements", "fa-location-crosshairs", "위치 이동 이력"]);
  }
  const navLink = ([href, icon, text], sub = false) =>
    `<a href="${href}" class="${sub ? "nav-sub-link" : "archive-nav-item"}"><i class="fa-solid ${icon}" aria-hidden="true"></i>${escapeHtml(text)}</a>`;
  const navGroup = (label, links, extras = "") => links.length || extras
    ? `<details class="nav-group" aria-label="${escapeHtml(label)}" data-nav-group="${escapeHtml(label)}"><summary class="nav-group-label">${escapeHtml(label)}</summary><div class="nav-group-content">${links.map((link) => navLink(link)).join("")}${extras}</div></details>`
    : "";
  const nestedGroup = (label, icon, links) => links.length
    ? `<details class="nav-settings"><summary><i class="fa-solid ${icon}" aria-hidden="true"></i>${escapeHtml(label)}</summary><div>${links.map((link) => navLink(link, true)).join("")}</div></details>`
    : "";
  const operationExtras = `${nestedGroup("기준정보", "fa-database", masterLinks)}${nestedGroup("이력·증적", "fa-folder-tree", evidenceLinks)}`;
  const allLinks = [
    ...documentLinks,
    ...workLinks,
    ...operationLinks,
    ...masterLinks,
    ...evidenceLinks
  ];
  const mobileTabs = `${documentLinks.map(([href, icon, text]) => `<a href="${href}" class="archive-nav-item mobile-tab"><i class="fa-solid ${icon}" aria-hidden="true"></i><span>${text === "보관 위치" ? "위치" : "검색"}</span></a>`).join("")}<button type="button" class="archive-nav-item mobile-tab" data-mobile-more aria-controls="primary-navigation" aria-expanded="false"><i class="fa-solid fa-ellipsis" aria-hidden="true"></i><span>더보기</span></button>`;
  const utilityLinks = [["/qa", "fa-circle-info", "도움말·문의"]];
  const commandLinks = [...allLinks, ...utilityLinks].map(([href, icon, text]) => `<a href="${href}" data-command-item data-command-label="${escapeHtml(text)}"><i class="fa-solid ${icon}"></i><span>${escapeHtml(text)}</span></a>`).join("");
  const roleLabel = session.roleTemplateKey && session.roleTemplateLabel
    ? session.roleTemplateLabel
    : session.role === "Admin" ? "시스템관리" : "사용자 지정";

  return `
    <header class="topbar">
      <a href="/app" class="brand"><img class="brand-logo" src="/images/hanlim-pharm-logo.svg" alt="한림제약"><span><strong>한림문서고</strong><small>통합 문서 위치 검색</small></span></a>
      <button type="button" class="command-trigger" data-command-open aria-haspopup="dialog"><i class="fa-solid fa-magnifying-glass"></i><span>메뉴 찾기</span><kbd>Ctrl+K</kbd></button>
      <nav id="primary-navigation" aria-label="주 메뉴" data-nav-menu>
        <button type="button" class="drawer-close" data-drawer-close aria-label="메뉴 닫기">×</button>
        <div class="nav-primary-links" role="group" aria-label="주요 문서 메뉴">${documentLinks.map((link) => navLink(link)).join("")}</div>
        ${navGroup("업무", workLinks)}
        ${navGroup("운영", operationLinks, operationExtras)}
        <div class="nav-user">
          <span class="session-pill">${escapeHtml(session.displayName)} · ${escapeHtml(roleLabel)}</span>
          <a href="/qa" class="nav-sub-link"><i class="fa-solid fa-circle-info" aria-hidden="true"></i>도움말·문의</a>
          <a href="/account/password" class="nav-sub-link"><i class="fa-solid fa-key"></i>비밀번호</a>
          <form method="post" action="/logout" class="logout-form">
            <button type="submit" class="logout-link"><i class="fa-solid fa-right-from-bracket"></i>로그아웃</button>
          </form>
        </div>
      </nav>
      <div class="nav-scrim" data-nav-scrim></div>
      <dialog class="command-palette" data-command-palette aria-labelledby="command-title">
        <div class="command-palette-head"><strong id="command-title">메뉴 찾기</strong><button type="button" class="icon-button" data-command-close aria-label="닫기">×</button></div>
        <label class="sr-only" for="command-filter">메뉴 검색</label>
        <input id="command-filter" type="search" placeholder="이동할 메뉴를 입력하세요" autocomplete="off" data-command-input>
        <div class="command-palette-list" data-command-list>${commandLinks}</div>
        <p class="muted">Ctrl+K로 열기 · 방향키로 이동 · Enter로 실행</p>
      </dialog>
    </header>
    <nav class="mobile-tabs" aria-label="주요 메뉴">${mobileTabs}</nav>
  `;
}

export function alertDanger(message) {
  return `<div class="alert danger" role="alert" aria-live="assertive">${escapeHtml(message)}</div>`;
}

export function alertWarning(message) {
  return `<div class="alert warning" role="alert">${escapeHtml(message)}</div>`;
}

export function statusBadge(status) {
  return `<span class="status ${status === "active" ? "document-active" : "document-disposed"}">${status === "active" ? "보관중" : "폐기"}</span>`;
}

export function sectionHeader(title, count) {
  return `<div class="section-title"><h2>${escapeHtml(title)}</h2><span class="count-badge">${escapeHtml(count)}</span></div>`;
}

export function emptyState(message) {
  return `<div class="empty-state"><i class="fa-regular fa-folder-open"></i><p>${escapeHtml(message)}</p></div>`;
}

export function emptyResult(message, query = "") {
  return `
    <div class="empty-state">
      <i class="fa-regular fa-folder-open"></i>
      <p>${escapeHtml(message)}</p>
      ${query ? `<div class="empty-actions"><a class="button secondary sm" href="/app" data-viewer-search-reset>검색 초기화</a></div>` : ""}
    </div>
  `;
}

export function metric(label, value, caption) {
  return `<article class="metric-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(caption)}</small></article>`;
}

export function option(value, label, selected) {
  const sel = String(value) === String(selected ?? "") ? " selected" : "";
  return `<option value="${escapeHtml(String(value))}"${sel}>${escapeHtml(label)}</option>`;
}

export function formValue(values, camelKey, snakeKey) {
  return values?.[camelKey] ?? values?.[snakeKey] ?? "";
}

export function timeline(rows, renderer, emptyMessage) {
  return rows.length ? `<div class="timeline-container">${rows.map(renderer).join("")}</div>` : emptyState(emptyMessage);
}

export function timelineItem(title, meta, body) {
  return `<div class="timeline-item"><div class="timeline-badge"></div><div class="timeline-content"><div class="timeline-header"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(meta)}</span></div>${body ? `<p>${escapeHtml(body)}</p>` : ""}</div></div>`;
}

// 문서 목록(/documents)과 뷰어 검색 폼(/app)이 같은 검색 필터를 공유한다.
// viewer 변형은 라벨 노출·placeholder 문구·정렬 항목 순서만 다르고 구조는 동일하다.
export function filterSelectRow({ categories, tags, filters, viewer = false, formId = "", showReset = true, resetHref = "/app" }) {
  if (viewer) {
    const formAttribute = formId ? ` form="${escapeHtml(formId)}"` : "";
    const sortOptions = [["updated", "최신순"], ["location", "위치순"], ["docnum", "문서번호순"], ["category", "대분류순"]]
      .map(([value, text]) => option(value, text, filters.sort))
      .join("");
    return `<div class="viewer-filter-row">
          <label>대분류<select name="category"${formAttribute}><option value="">전체</option>${categories.map((c) => option(c.id, c.name, filters.categoryId)).join("")}</select></label>
          <label>태그<select name="tag"${formAttribute}><option value="">전체</option>${tags.map((tag) => option(tag.id, tag.name, filters.tagId)).join("")}</select></label>
          <label>보관 위치<select name="zone"${formAttribute}><option value="">전체</option>${[1, 2, 3].map((zone) => option(zone, `${zone}구역`, filters.zoneNumber)).join("")}</select></label>
          <label>정렬<select name="sort"${formAttribute}>${option("relevance", "정확도순", filters.sort || "relevance")}${sortOptions}</select></label>
          ${showReset ? `<a class="button secondary sm" href="${escapeHtml(resetHref)}" data-viewer-filter-reset>초기화</a>` : ""}
        </div>`;
  }
  const label = (text) => (viewer ? text : `<span class="sr-only">${text}</span>`);
  const blank = (text) => (viewer ? "전체" : `전체 ${text}`);
  const sortOptions = (viewer
    ? [["updated", "최신순"], ["location", "위치순"], ["docnum", "문서번호순"], ["category", "대분류순"]]
    : [["updated", "최신순"], ["docnum", "문서번호순"], ["category", "대분류순"], ["location", "랙 위치순"]])
    .map(([value, text]) => option(value, text, filters.sort))
    .join("\n              ");
  return `<div class="${viewer ? "viewer-filter-row" : "filter-row"}">
          <label>${label("대분류")}
            <select name="category">
              <option value="">${blank("대분류")}</option>
              ${categories.map((c) => option(c.id, viewer ? c.name : `${c.name}`, filters.categoryId)).join("")}
            </select>
          </label>
          <label>${label("태그")}
            <select name="tag">
              <option value="">${blank("태그")}</option>
              ${tags.map((tag) => option(tag.id, tag.name, filters.tagId)).join("")}
            </select>
          </label>
          <label>${label("구역")}
            <select name="zone">
              <option value="">${blank("구역")}</option>
              ${[1, 2, 3].map((zone) => option(zone, `${zone}구역`, filters.zoneNumber)).join("")}
            </select>
          </label>
          <label>${label("정렬")}
            <select name="sort">
              ${option("relevance", "정확도순", filters.sort || "relevance")}
              ${sortOptions}
            </select>
          </label>
${viewer ? `          <a class="button secondary sm" href="/app">초기화</a>
` : ""}        </div>`;
}

// /app과 /documents 목록이 같은 페이지 내비 마크업을 공유한다(호출부가 URL만 다르게 만든다).
export function paginationNav(page, totalPages, { previousUrl, nextUrl, hasMore = false }) {
  const unknownTotal = totalPages === null || totalPages === undefined;
  return `
    <nav class="pagination" aria-label="검색 결과 페이지">
      ${page === 1 ? `<span class="button secondary sm disabled" aria-disabled="true">이전</span>` : `<a class="button secondary sm" href="${previousUrl}">이전</a>`}
      <span>${unknownTotal ? `${page}페이지` : `${page} / ${totalPages}`}</span>
      ${unknownTotal
        ? (hasMore ? `<a class="button secondary sm" href="${nextUrl}">다음</a>` : `<span class="button secondary sm disabled" aria-disabled="true">다음</span>`)
        : (page === totalPages ? `<span class="button secondary sm disabled" aria-disabled="true">다음</span>` : `<a class="button secondary sm" href="${nextUrl}">다음</a>`)}
    </nav>
  `;
}

// 목록 URL 생성기. paramOrder 배열 순서가 곧 쿼리스트링 파라미터 순서다(기존 URL 형태 유지).
export function listUrl(basePath, { query, filters = {}, page = 1 }, paramOrder) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  for (const [param, key] of paramOrder) {
    if (filters[key]) params.set(param, filters[key]);
  }
  if (page > 1) params.set("page", String(page));
  const text = params.toString();
  return text ? `${basePath}?${text}` : basePath;
}
