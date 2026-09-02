// 준비 문서 세트 화면.

import { hasReadPermission, PERMISSIONS } from "../permissions.js";
import { locationLabel } from "../domains/racks/index.js";
import { escapeHtml } from "../ui/html/escape.js";
import { archiveMap } from "./floorPlanViews.js";
import { alertDanger, alertWarning, emptyState, metric, page, sectionHeader, statusBadge, timeline, timelineItem } from "./layout.js";

export function setsPage({ session, sets, filters = {} }) {
  const canManage = hasReadPermission(session, PERMISSIONS.MANAGE_SETS);
  return page("준비 문서 세트", `
    <section class="page-head">
      <h1>준비 문서 세트</h1>
      <div class="button-group">
        ${canManage ? `<a class="button" href="/sets/new">세트 만들기</a>` : ""}
      </div>
    </section>
    <p class="muted">감사 준비문서 목록처럼 자주 찾는 문서 묶음을 저장해 두고 한눈에 관리합니다.</p>
    <section class="panel">
      <form method="get" action="/sets" class="filter-row set-list-filters">
        <label class="search-input"><span>세트 검색</span><input type="search" name="q" value="${escapeHtml(filters.q || "")}" placeholder="세트 이름 또는 설명"></label>
        <label><span>상태</span><select name="status">
          ${setFilterOption("all", "전체", filters.status)}
          ${setFilterOption("editable", "편집 가능", filters.status)}
          ${setFilterOption("locked", "잠김", filters.status)}
          ${setFilterOption("disposed", "폐기 포함", filters.status)}
          ${setFilterOption("excluded", "제외 포함", filters.status)}
        </select></label>
        <label><span>정렬</span><select name="sort">
          ${setFilterOption("updated", "최근 수정순", filters.sort)}
          ${setFilterOption("created", "최근 생성순", filters.sort)}
          ${setFilterOption("name", "이름순", filters.sort)}
        </select></label>
        <button type="submit" class="button">적용</button>
        <a class="button secondary" href="/sets">초기화</a>
      </form>
    </section>
    ${sets.length ? `<section class="rack-grid">
      ${sets.map((set) => `
        <a class="panel rack-card" href="/sets/${set.id}">
          <small>문서 ${Number(set.document_count || set.documentCount || 0)}건${Number(set.excluded_count || set.excludedCount || 0) ? ` · 대장 제외 ${Number(set.excluded_count || set.excludedCount)}건` : ""}${Number(set.disposed_count || set.disposedCount || 0) ? ` · 폐기 ${Number(set.disposed_count || set.disposedCount)}건 포함` : ""}${Number(set.is_locked) || set.isLocked ? " · 잠김" : ""}</small>
          <strong>${escapeHtml(set.name)}</strong>
          <span>${escapeHtml(set.description || "설명 없음")}</span>
        </a>
      `).join("")}
    </section>` : emptyState(canManage ? "아직 세트가 없습니다. 세트를 만들고 준비문서를 등록하세요." : "아직 등록된 세트가 없습니다.")}
  `, session);
}

export function setFormPage({ session, values = {}, action, title, error = "" }) {
  const expectedRowVersion = Number(values.row_version ?? values.expectedRowVersion ?? values.rowVersion ?? 0);
  return page(title, `
    <section class="page-head"><h1>${escapeHtml(title)}</h1></section>
    <section class="panel narrow">
      ${error ? alertDanger(error) : ""}
      <form method="post" action="${escapeHtml(action)}" class="stack">
        ${expectedRowVersion > 0 ? `<input type="hidden" name="expectedRowVersion" value="${expectedRowVersion}">` : ""}
        <label>세트 이름 <em>*</em><input name="name" value="${escapeHtml(values.name || "")}" maxlength="100" required placeholder="예: 2026년 정기감사 준비문서"></label>
        <label>설명<textarea name="description" rows="3" placeholder="세트 용도나 기준을 기록해 두세요.">${escapeHtml(values.description || "")}</textarea></label>
        <button type="submit" class="primary">저장</button>
      </form>
    </section>
  `, session);
}

export function setClonePage({ session, set, documentCount = 0, values = {}, error = "" }) {
  const suggestedName = values.name || `${set.name} 복사본`;
  return page("준비 문서 세트 복제", `
    <section class="page-head"><div><h1>준비 문서 세트 복제</h1><p class="muted">원본 구성원 ${Number(documentCount).toLocaleString("ko-KR")}건을 그대로 복사하고, 새 세트는 편집 가능한 상태로 만듭니다.</p></div></section>
    <section class="panel narrow">
      ${error ? alertDanger(error) : ""}
      <dl class="detail-list">
        <div><dt>원본 세트</dt><dd>${escapeHtml(set.name)}</dd></div>
        <div><dt>원본 버전</dt><dd>${Number(set.row_version || 0)}</dd></div>
        <div><dt>새 세트 상태</dt><dd>편집 가능</dd></div>
      </dl>
      <form method="post" action="/sets/${Number(set.id)}/clone" class="stack">
        <input type="hidden" name="expectedRowVersion" value="${Number(values.expectedRowVersion || set.row_version || 0)}">
        <label>새 세트 이름 <em>*</em><input name="name" value="${escapeHtml(suggestedName)}" maxlength="100" required></label>
        <div class="button-group"><a class="button secondary" href="/sets/${Number(set.id)}">취소</a><button type="submit" class="primary">복제</button></div>
      </form>
    </section>
  `, session);
}

export function setDetailsPage({ session, set, documents, racks, logs = [], addQuery = "", addCandidates = null, selectedCandidateIds = [], preserveAddSelection = false, addResult = null, error = "", printedAt = new Date() }) {
  const canManage = hasReadPermission(session, PERMISSIONS.MANAGE_SETS);
  const isLocked = Number(set.is_locked) === 1;
  const disposedCount = documents.filter((doc) => doc.status !== "active").length;
  const excludedCount = documents.filter((doc) => doc.sync_state === "excluded").length;
  const currentDocuments = documents.filter((doc) => doc.sync_state !== "excluded");
  const rackCount = new Set(currentDocuments.map((doc) => doc.rack_code)).size;
  const zoneCount = new Set(currentDocuments.map((doc) => doc.zone_number)).size;
  const hits = new Set(currentDocuments.map((doc) => `${doc.rack_code}:${doc.rack_face}`));

  return page(`${set.name} 세트`, `
    <section class="page-head">
      <div><h1>${escapeHtml(set.name)}</h1>${set.description ? `<p class="page-sub">${escapeHtml(set.description)}</p>` : ""}</div>
      <div class="button-group">
        <button type="button" class="button secondary" data-print><i class="fa-solid fa-print"></i> 목록 인쇄</button>
        <a class="button secondary" href="/sets/${set.id}/export.csv">CSV 내보내기</a>
        ${canManage ? `<a class="button secondary" href="/sets/${set.id}/clone">세트 복제</a>` : ""}
        ${canManage && !isLocked ? `<a class="button secondary" href="/sets/${set.id}/edit">세트 수정</a>` : ""}
      </div>
    </section>
    ${error ? alertDanger(error) : ""}
    ${isLocked ? alertWarning(`이 세트는 편집 잠금 상태입니다.${set.lock_reason ? ` 사유: ${set.lock_reason}` : ""}`) : ""}
    ${excludedCount ? alertWarning(`대장 제외 문서 ${excludedCount}건이 세트에 포함되어 있습니다. 연결은 감사 근거로 보존되며 랙 지도에는 현재 대장 문서만 표시합니다.`) : ""}
    ${addResult ? setAddResultView(addResult, set) : ""}
    ${setPrintHeader({ set, session, documents, printedAt })}
    <section class="metric-strip" aria-label="세트 요약">
      ${metric("문서", documents.length, "세트에 등록된 문서")}
      ${metric("현재 대장", currentDocuments.length, "sync_state=current")}
      ${metric("대장 제외", excludedCount, excludedCount ? "목록 확인 필요" : "없음")}
      ${metric("보관 랙", rackCount, `${zoneCount}개 구역`)}
      ${metric("폐기 포함", disposedCount, disposedCount ? "목록 확인 필요" : "없음")}
    </section>
    <section class="panel">
      ${sectionHeader("보관 위치 목록", `${documents.length}건`)}
      ${documents.length ? `<p class="muted">구역 → 랙 → 열 → 선반 순으로 정렬되어 있어 문서고에서 한 번에 돌며 꺼낼 수 있습니다.</p>` : ""}
      ${setDocumentTable(set, documents, canManage && !isLocked)}
    </section>
    ${documents.length ? `<section class="panel">
      ${sectionHeader("랙 지도", `${rackCount}개 랙`)}
      ${archiveMap(racks, hits)}
    </section>` : ""}
    ${canManage ? setLockControls(set, isLocked) : ""}
    ${canManage && (!isLocked || preserveAddSelection) ? setAdminTools(set, addQuery, addCandidates, selectedCandidateIds, { readOnly: isLocked }) : ""}
    ${logs.length ? `<section class="panel">
      ${sectionHeader("세트 변경 이력", `${logs.length}건`)}
      ${timeline(logs, renderSetLog, "변경 이력이 없습니다.")}
    </section>` : ""}
    ${setPrintFooter()}
  `, session);
}

function renderSetLog(log) {
  const labels = { create: "세트 생성", update: "정보 수정", delete: "세트 삭제", add: "문서 추가", remove: "문서 제외" };
  return timelineItem(labels[log.action] || log.action, `${log.actor} / ${log.created_at}`, log.details || "");
}

function setDocumentTable(set, documents, canEdit) {
  if (!documents.length) {
    return emptyState(canEdit ? "아직 세트에 담긴 문서가 없습니다. 아래에서 문서를 추가하세요." : "아직 세트에 담긴 문서가 없습니다.");
  }

  return `
    <div class="table-wrap"><table class="set-doc-table">
      <caption class="sr-only">${escapeHtml(set.name)} 세트 문서 위치 목록</caption>
      <thead><tr><th class="print-only print-check-column">확인</th><th>순번</th><th>보관 위치</th><th>문서번호</th><th>개정</th><th>문서명</th><th>대분류</th><th>상태</th><th>대장 포함</th>${canEdit ? "<th class=\"screen-only\">관리</th>" : ""}</tr></thead>
      <tbody>${documents.map((doc, index) => `
        <tr class="${doc.status !== "active" ? "is-disposed" : ""}${doc.sync_state === "excluded" ? " is-excluded" : ""}">
          <td class="print-only print-check-cell">□</td>
          <td>${index + 1}</td>
          <td><strong>${escapeHtml(locationLabel(doc))}</strong></td>
          <td>${escapeHtml(doc.document_number)}</td>
          <td>${escapeHtml(doc.revision_number)}</td>
          <td><a href="/documents/${doc.id}">${escapeHtml(doc.document_name)}</a></td>
          <td>${escapeHtml(doc.category_name)}</td>
          <td>${statusBadge(doc.status)}</td>
          <td>${doc.sync_state === "excluded" ? `<span class="status ledger-excluded">대장 제외</span>` : `<span class="status ledger-current">포함</span>`}</td>
          ${canEdit ? `<td class="screen-only"><form method="post" action="/sets/${set.id}/remove" data-confirm="세트에서 이 문서를 제외할까요?"><input type="hidden" name="documentId" value="${doc.id}"><input type="hidden" name="expectedRowVersion" value="${escapeHtml(set.row_version ?? 0)}"><button type="submit" class="danger-button sm">제외</button></form></td>` : ""}
        </tr>
      `).join("")}</tbody>
    </table></div>
  `;
}

function setAddResultView(result, set) {
  const added = `<div class="alert success" role="status">${result.added}건을 세트에 추가했습니다.</div>`;
  const missing = result.missing.length
    ? `<div class="alert warning"><strong>찾지 못한 번호 ${result.missing.length}건</strong><div class="missing-document-links">${result.missing.map((number) => `<a href="/documents/new?documentNumber=${encodeURIComponent(number)}&returnTo=${encodeURIComponent(`/sets/${set.id}`)}">${escapeHtml(number)} 등록</a>`).join("")}</div></div>`
    : "";
  return `${added}${missing}`;
}

function setLockControls(set, isLocked) {
  const action = isLocked ? "unlock" : "lock";
  const title = isLocked ? "세트 잠금 해제" : "세트 편집 잠금";
  return `<section class="panel set-lock-panel">
    ${sectionHeader(title, isLocked ? "잠김" : "편집 가능")}
    <form method="post" action="/sets/${set.id}/${action}" class="lock-form">
      <input type="hidden" name="expectedRowVersion" value="${escapeHtml(set.row_version ?? 0)}">
      <label>${isLocked ? "잠금 해제 사유" : "잠금 사유"}<input name="reason" maxlength="500" required></label>
      <button type="submit" class="button secondary">${title}</button>
    </form>
    ${isLocked ? `<p class="muted">${escapeHtml(set.locked_by_name || "알 수 없음")} · ${escapeHtml(set.locked_at || "-")}</p>` : `<p class="muted">잠금 후에는 문서 추가·제외와 세트 정보 수정을 할 수 없습니다.</p>`}
  </section>`;
}

function setPrintHeader({ set, session, documents, printedAt }) {
  const date = printedAt instanceof Date && !Number.isNaN(printedAt.valueOf())
    ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "long", timeStyle: "short" }).format(printedAt)
    : String(printedAt || "");
  return `<section class="print-only set-print-header">
    <div class="set-print-brand"><img src="/images/hanlim-pharm-logo.svg" alt="한림제약"><span>한림문서고</span></div>
    <h1>${escapeHtml(set.name)}</h1>
    <p>${escapeHtml(set.description || "설명 없음")}</p>
    <dl><div><dt>출력일시</dt><dd>${escapeHtml(date)}</dd></div><div><dt>출력자</dt><dd>${escapeHtml(session.displayName || session.username)}</dd></div><div><dt>총 문서 수</dt><dd>${documents.length}건</dd></div></dl>
  </section>`;
}

function setPrintFooter() {
  return `<section class="print-only set-print-signatures"><div>작성자 서명 <span></span></div><div>검토자 서명 <span></span></div></section><div class="print-only set-print-page">페이지 <span></span></div>`;
}

function setAdminTools(set, addQuery, addCandidates, selectedCandidateIds = [], { readOnly = false } = {}) {
  if (readOnly) {
    return `
      <section class="panel set-admin-tools" data-preserved-set-selection>
        ${sectionHeader("문서 추가 요청", "잠금 경합")}
        ${alertWarning("세트가 잠겨 추가 작업은 중단됐지만 검색 조건과 선택 문서는 보존했습니다.")}
        <label>보존된 검색 조건<input value="${escapeHtml(addQuery)}" readonly></label>
        ${addCandidates ? setCandidateList(set, addQuery, addCandidates, selectedCandidateIds, { readOnly: true }) : ""}
      </section>
    `;
  }
  return `
    <section class="panel set-admin-tools">
      ${sectionHeader("문서 추가", "관리자")}
      <div class="set-add-grid">
        <form method="post" action="/sets/${set.id}/add" class="stack">
          <input type="hidden" name="expectedRowVersion" value="${escapeHtml(set.row_version ?? 0)}">
          <label>문서번호 일괄 추가
            <textarea name="numbers" rows="4" placeholder="문서번호를 줄바꿈이나 쉼표로 구분해 붙여넣으세요.&#10;예) MR-2026-001, PV-2026-014"></textarea>
          </label>
          <button type="submit" class="primary">일괄 추가</button>
        </form>
        <div class="stack">
          <form method="get" action="/sets/${set.id}" class="stack">
            <label>문서 검색으로 추가
              <input name="add-q" value="${escapeHtml(addQuery)}" placeholder="문서명, 문서번호, 위치 검색">
            </label>
            <button type="submit" class="button secondary">검색</button>
          </form>
          ${addCandidates ? setCandidateList(set, addQuery, addCandidates, selectedCandidateIds) : ""}
        </div>
      </div>
      <div class="set-danger-row">
        <form method="post" action="/sets/${set.id}/delete" data-confirm="세트를 삭제할까요? 세트에 담긴 문서 자체는 삭제되지 않습니다.">
          <input type="hidden" name="expectedRowVersion" value="${escapeHtml(set.row_version ?? 0)}">
          <button type="submit" class="danger-button">세트 삭제</button>
        </form>
      </div>
    </section>
  `;
}

function setCandidateList(set, addQuery, candidates, selectedCandidateIds = [], { readOnly = false } = {}) {
  if (!candidates.length) {
    return `<p class="muted">검색 결과가 없습니다.</p>`;
  }

  const selected = new Set(selectedCandidateIds.map(Number));
  const tag = readOnly ? "div" : "form";
  return `<${tag}${readOnly ? "" : ` method="post" action="/sets/${set.id}/add"`} class="stack">
    <input type="hidden" name="add-q" value="${escapeHtml(addQuery)}">
    <input type="hidden" name="expectedRowVersion" value="${escapeHtml(set.row_version ?? 0)}">
    <div class="set-candidate-list">${candidates.map((doc) => `
      <label class="set-candidate ${doc.status !== "active" ? "is-disposed" : ""}">
        <input type="checkbox" name="documentIds" value="${Number(doc.id)}" ${(doc.inSet || readOnly) ? "disabled" : ""} ${selected.has(Number(doc.id)) ? "checked" : ""}>
        <span>
          <strong>${escapeHtml(doc.document_name)}</strong> ${statusBadge(doc.status)}
          <small>${escapeHtml(doc.document_number)} · ${escapeHtml(doc.revision_number)} · ${escapeHtml(locationLabel(doc))}</small>
        </span>
        ${doc.inSet ? `<span class="muted">이미 포함됨</span>` : ""}
      </label>
    `).join("")}</div>
    ${readOnly ? "" : `<button type="submit" class="button">선택 문서 추가 (최대 200건)</button>`}
  </${tag}>`;
}

function setFilterOption(value, label, selected) {
  return `<option value="${value}"${String(selected || "all") === value ? " selected" : ""}>${label}</option>`;
}
