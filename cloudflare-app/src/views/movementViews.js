// 문서 위치 이동 전용 화면과 전역 이동 이력.

import { documentLink } from "../shared/documents/navigation.js";
import { hasReadPermission, PERMISSIONS } from "../permissions.js";
import { locationLabel } from "../domains/racks/index.js";
import { escapeHtml } from "../ui/html/escape.js";
import { locationPicker, locationPickerScript } from "./documentLocationPicker.js";
import { alertDanger, emptyState, option, page, paginationNav, sectionHeader } from "./layout.js";

export function canMoveDocuments(session) {
  return hasReadPermission(session, PERMISSIONS.MOVE_DOCUMENTS);
}

export function movementFormPage({ session, document, slots, movements = [], error = "", values = {} }) {
  const currentLocation = locationLabel(document);
  const selectedSlot = values.rackSlotId || document.rack_slot_id;
  const selectedFace = values.rackFace || document.rack_face || "A";
  return page("문서 위치 이동", `
    <section class="page-head">
      <div><h1>문서 위치 이동</h1><p class="page-sub">${escapeHtml(document.document_number)} · ${escapeHtml(document.document_name)}</p></div>
      <a class="button secondary" href="${escapeHtml(documentLink(document.id, "", values.returnTo))}">문서 상세</a>
    </section>
    ${error ? `<div class="form-error-summary" data-error-summary role="alert" tabindex="-1">${escapeHtml(error)}</div>` : ""}
    <section class="locator-hero movement-current">
      <div><small>현재 위치</small><strong class="loc-label-lg">${escapeHtml(currentLocation)}</strong></div>
    </section>
    <section class="panel narrow">
      <form method="post" action="/documents/${document.id}/move" class="stack" data-movement-form>
        <input type="hidden" name="returnTo" value="${escapeHtml(values.returnTo || "")}">
        <input type="hidden" name="expectedUpdatedAt" value="${escapeHtml(values.expectedUpdatedAt ?? document.updated_at)}">
        <input type="hidden" name="expectedRowVersion" value="${escapeHtml(values.expectedRowVersion ?? document.row_version)}">
        ${locationPicker(slots, selectedSlot)}
        <label>보관 면 <em>*</em><select name="rackFace" required data-rack-face>${option("A", "1면", selectedFace)}${option("B", "2면", selectedFace)}</select></label>
        <label>이동 사유 <em>*</em><textarea name="reason" rows="3" maxlength="500" required placeholder="예: 1구역 재배치에 따른 위치 변경">${escapeHtml(values.reason || "")}</textarea></label>
        <div class="movement-preview" aria-live="polite">
          <span>${escapeHtml(currentLocation)}</span><strong aria-hidden="true">→</strong><span data-movement-target>새 위치를 선택하세요.</span>
        </div>
        <button type="submit" class="primary">위치 이동</button>
      </form>
    </section>
    ${movementHistory(movements, "최근 위치 이동 이력")}
    ${locationPickerScript()}
    ${movementPreviewScript()}
  `, session);
}

function movementPreviewScript() {
  return `<script>
    (function () {
      var form = document.querySelector('[data-movement-form]');
      if (!form) return;
      var target = form.querySelector('[data-movement-target]');
      var slot = form.querySelector('select[name="rackSlotId"]');
      var face = form.querySelector('select[name="rackFace"]');
      var update = function () {
        var selected = slot && slot.options[slot.selectedIndex];
        var label = selected && selected.value ? selected.textContent.trim() : '새 위치를 선택하세요.';
        if (selected && selected.value && face) label += ' / ' + (face.value === 'B' ? '2면' : '1면');
        if (target) target.textContent = label;
      };
      form.querySelectorAll('select').forEach(function (select) { select.addEventListener('change', update); });
      update();
    })();
  </script>`;
}

export function movementHistory(rows, title = "위치 이동 이력") {
  return `<section class="panel movement-history">
    ${sectionHeader(title, `${rows.length}건`)}
    ${rows.length ? `<div class="table-wrap"><table>
      <thead><tr><th>일시</th><th>문서번호</th><th>이전 위치</th><th>새 위치</th><th>사유</th><th>수행자</th></tr></thead>
      <tbody>${rows.map((row) => `<tr>
        <td>${escapeHtml(row.created_at || "-")}</td>
        <td><a href="/documents/${Number(row.document_id)}">${escapeHtml(row.document_number_snapshot)}</a></td>
        <td>${escapeHtml(row.from_location_snapshot)}</td>
        <td><strong>${escapeHtml(row.to_location_snapshot)}</strong></td>
        <td>${escapeHtml(row.reason)}</td>
        <td>${escapeHtml(row.performed_by_name)} <small class="muted">${escapeHtml(row.performed_by_username)}</small></td>
      </tr>`).join("")}</tbody>
    </table></div>` : emptyState("위치 이동 이력이 없습니다.")}
  </section>`;
}

export function movementsPage({ session, result, query = "" }) {
  const previousUrl = `/admin/movements?q=${encodeURIComponent(query)}&page=${Math.max(1, result.page - 1)}`;
  const nextUrl = `/admin/movements?q=${encodeURIComponent(query)}&page=${Math.min(result.totalPages, result.page + 1)}`;
  return page("위치 이동 이력", `
    <section class="page-head"><div><h1>위치 이동 이력</h1><p class="page-sub">문서 위치 변경 전후와 사유를 조회합니다.</p></div></section>
    <section class="panel">
      <form method="get" action="/admin/movements" class="filter-row movement-filter">
        <label>문서번호 또는 수행자<input name="q" value="${escapeHtml(query)}" placeholder="검색어"></label>
        <button type="submit" class="button">조회</button>
      </form>
    </section>
    ${movementHistory(result.items, "전체 위치 이동")}
    ${paginationNav(result.page, result.totalPages, { previousUrl, nextUrl })}
  `, session);
}
