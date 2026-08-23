// 보관 랙 화면.

import { readBoolean } from "../shared/coercion.js";
import { escapeHtml } from "../ui/html/escape.js";
import { documentResults } from "./documentTableViews.js";
import { displayedColumns, rackColumnOrigin } from "../domains/racks/domain/orientation.js";
import { alertDanger, page } from "./layout.js";

export function racksPage({ session, racks }) {
  return page("랙 관리", `
    <section class="page-head"><h1>보관 랙 목록</h1><div class="button-group"><a class="button secondary" href="/racks/configure">구역별 설정</a><a class="button" href="/racks/new">랙 추가</a></div></section>
    <section class="rack-grid">
      ${racks.map((rack) => `
        <a class="panel rack-card" href="/racks/${rack.id}">
          <small>${rack.zone_number}구역</small>
          <strong>${rack.rack_number}번 랙</strong>
          <span>${escapeHtml(rack.code)} · ${readBoolean(rack.is_single_sided) ? "단면" : `양면 ${rack.rack_number}-1·${rack.rack_number}-2`} · ${rack.active_document_count || 0}건</span>
        </a>
      `).join("")}
    </section>
  `, session);
}

export function rackConfigurePage({ session, counts, expectedVersion = 0, error = "" }) {
  return page("랙 설정", `
    <section class="page-head"><h1>구역별 랙 수</h1></section>
    <section class="panel narrow">
      ${error ? alertDanger(error) : ""}
      <form method="post" action="/racks/configure" class="stack">
        <input type="hidden" name="expectedVersion" value="${escapeHtml(expectedVersion)}">
        ${[1, 2, 3].map((zone) => `<label>${zone}구역 랙 수<input type="number" name="zone${zone}Count" min="0" max="15" value="${escapeHtml(counts[zone] ?? 0)}"></label>`).join("")}
        <button type="submit" class="primary">저장</button>
      </form>
    </section>
  `, session);
}

export function rackDetailsPage({ session, rack, documents, grid = [], selectedFace = "A", selectedColumn = 0, selectedShelf = 0 }) {
  const face = readBoolean(rack.is_single_sided) || selectedFace !== "B" ? "A" : "B";
  const faceDocuments = readBoolean(rack.is_single_sided)
    ? documents
    : documents.filter((document) => document.rack_face === face);
  return page(`${rack.code} 랙`, `
    <section class="page-head">
      <h1>${rack.zone_number}구역 ${rack.rack_number}번 랙</h1>
      <a class="button" href="/racks/${rack.id}/edit">랙 수정</a>
    </section>
    <section class="locator-hero">
      <div><strong class="mono">${escapeHtml(rack.code)}</strong><span>${readBoolean(rack.is_single_sided) ? `단면 ${rack.rack_number}` : `양면 ${rack.rack_number}-1 / ${rack.rack_number}-2`} · 면당 ${rack.column_count || 7}열 × ${rack.shelf_count || 6}선반 = ${(rack.column_count || 7) * (rack.shelf_count || 6)}칸 · 문서 ${documents.length}건</span></div>
      <a class="button secondary" href="/app?rack=${rack.id}&face=${face}&status=active&sort=location">이 면의 문서 보기</a>
    </section>
    ${rackGridView({ rack, grid, face, selectedColumn, selectedShelf })}
    <section class="panel">${documentResults(faceDocuments, { emptyMessage: "이 면에 등록된 문서가 없습니다." })}</section>
  `, session);
}

function rackGridView({ rack, grid, face, selectedColumn, selectedShelf }) {
  const single = readBoolean(rack.is_single_sided);
  const origin = rackColumnOrigin(rack, face);
  const columns = displayedColumns(rack, face, 7);
  const byCell = new Map(grid.map((row) => [
    `${row.rack_face}:${Number(row.column_number)}:${Number(row.shelf_number)}`,
    row
  ]));
  const cells = [];

  // 모든 면은 사용자가 바라본 기준으로 왼쪽부터 1열, 아래부터 1선반이다.
  for (let shelf = 6; shelf >= 1; shelf -= 1) {
    for (const column of columns) {
      const row = byCell.get(`${face}:${column}:${shelf}`) || {};
      const active = Number(row.active_count || 0);
      const disposed = Number(row.disposed_count || 0);
      const selected = column === selectedColumn && shelf === selectedShelf;
      const base = `/app?rack=${rack.id}&face=${face}&column=${column}&shelf=${shelf}&sort=location`;
      cells.push(`
        <div class="rack-cell${selected ? " is-selected" : ""}${active + disposed === 0 ? " is-empty" : ""}" role="gridcell">
          <a href="${base}&status=active" aria-label="${column}열 ${shelf}선반 보관중 ${active}건">
            <span>${column}열 · ${shelf}선반</span><strong>${active}건</strong>
          </a>
          ${disposed ? `<a class="rack-cell-disposed" href="/documents/disposal?tab=documents">폐기 ${disposed}건</a>` : ""}
        </div>`);
    }
  }

  const faceTabs = single ? "" : `<nav class="rack-face-tabs" aria-label="랙 면 선택">
    <a href="/racks/${rack.id}?face=A" class="${face === "A" ? "active" : ""}" aria-current="${face === "A" ? "page" : "false"}">${rack.rack_number}-1면</a>
    <a href="/racks/${rack.id}?face=B" class="${face === "B" ? "active" : ""}" aria-current="${face === "B" ? "page" : "false"}">${rack.rack_number}-2면</a>
  </nav>`;
  return `<section class="panel rack-digital-twin">
    <div class="section-title"><h2>${single ? `${rack.rack_number}번 단면` : `${rack.rack_number}-${face === "B" ? "2" : "1"}면`} 위치 격자</h2><span class="count-badge">7열 × 6선반</span></div>
    ${faceTabs}
    <div class="rack-column-guide" data-column-origin="${origin}"><span>1열</span><strong>면을 바라본 모습</strong><span>7열</span></div>
    <div class="rack-grid-scroll" tabindex="0" aria-label="랙 위치 격자. 가로로 스크롤할 수 있습니다.">
      <div class="rack-digital-grid" role="grid" aria-rowcount="6" aria-colcount="7">${cells.join("")}</div>
    </div>
    <p class="muted">면을 바라본 기준으로 왼쪽부터 1열, 아래부터 1선반입니다. 화면에는 위쪽 6선반부터 아래쪽 1선반까지 표시됩니다.</p>
  </section>`;
}

export function rackFormPage({ session, values = {}, action, title, error = "" }) {
  const expectedRowVersion = Number(values.row_version ?? values.expectedRowVersion ?? values.rowVersion ?? 0);
  return page(title, `
    <section class="page-head"><h1>${escapeHtml(title)}</h1></section>
    <section class="panel narrow">
      ${error ? alertDanger(error) : ""}
      <form method="post" action="${escapeHtml(action)}" class="stack">
        ${expectedRowVersion > 0 ? `<input type="hidden" name="expectedRowVersion" value="${expectedRowVersion}">` : ""}
        <label>구역<input type="number" name="zoneNumber" min="1" max="3" value="${escapeHtml(values.zone_number ?? values.zoneNumber ?? 1)}" required></label>
        <label>랙 번호<input type="number" name="rackNumber" min="1" max="15" value="${escapeHtml(values.rack_number ?? values.rackNumber ?? 1)}" required></label>
        <p class="muted">랙 번호는 구역마다 1번부터 별도로 사용합니다. 예: 1구역 1번 랙과 2구역 1번 랙을 함께 등록할 수 있습니다.</p>
        <p class="muted">랙 구조는 면당 7열 × 6선반(42칸)으로 고정되어 있습니다.</p>
        <label>이름<input name="name" value="${escapeHtml(values.name || "")}"></label>
        <label>설명<textarea name="description" rows="3">${escapeHtml(values.description || "")}</textarea></label>
        <label class="check-inline"><input type="checkbox" name="isSingleSided" value="1" ${readBoolean(values.is_single_sided ?? values.isSingleSided) ? "checked" : ""}> 단면 랙</label>
        <p class="muted">양면 랙은 13-1/13-2처럼 면 단위로, 단면 랙은 13처럼 번호만으로 표기됩니다.</p>
        <label class="check-inline"><input type="checkbox" name="isActive" value="1" ${readBoolean(values.is_active ?? values.isActive ?? 1) ? "checked" : ""}> 사용</label>
        <button type="submit" class="primary">저장</button>
      </form>
    </section>
  `, session);
}
