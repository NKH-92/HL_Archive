import { hasReadPermission, PERMISSIONS, PERMISSION_LABELS } from "../permissions.js";
import { escapeHtml } from "../ui/html/escape.js";
import { formatRevisionLabel } from "../shared/documents/revision.js";
import { alertDanger, page } from "./layout.js";

const STATUS_LABELS = Object.freeze({
  staging: "업로드 중",
  ready: "반영 대기",
  applying: "반영 중",
  completed: "반영 완료",
  cancelled: "취소",
  failed: "검증 실패"
});

const ACTION_LABELS = Object.freeze({
  create: "신규",
  update: "변경",
  unchanged: "유지",
  staged: "검증 전"
});

const FLAG_LABELS = Object.freeze({
  CREATE: "신규",
  METADATA: "일반정보",
  MOVE: "위치",
  DISPOSE: "폐기",
  RESTORE: "폐기 해제",
  TAG_CHANGE: "태그",
  REINCLUDE: "재포함",
  UNCHANGED: "유지"
});

export function documentSnapshotPage({ session, state, snapshots = [], error = "", applyMode = "admin-only" }) {
  const canApply = hasReadPermission(session, PERMISSIONS.APPLY_DOCUMENT_SNAPSHOTS)
    && (applyMode !== "admin-only" || session.role === "Admin" || session.demoReadAuthorized);
  const rows = snapshots.map((snapshot) => `
    <tr>
      <td class="mono" data-label="작업 번호"><a href="/document-snapshots/${Number(snapshot.id)}">${escapeHtml(snapshot.snapshot_code)}</a></td>
      <td data-label="파일">${escapeHtml(snapshot.source_name)}</td>
      <td data-label="상태">${snapshotStatus(snapshot.status)}</td>
      <td data-label="문서 수">${number(snapshot.total_count)}</td>
      <td data-label="추가 / 변경 / 제외">${number(snapshot.create_count)} / ${number(snapshot.update_count)} / ${number(snapshot.exclude_count)}</td>
      <td data-label="작업자">${escapeHtml(snapshot.created_by_name)}</td>
      <td data-label="생성일">${escapeHtml(snapshot.created_at)}</td>
    </tr>
  `).join("");
  return page("엑셀 대장 동기화", `
    <script defer src="/assets/jszip.min.js"></script>
    <script defer src="/assets/exceljs.min.js"></script>
    <script defer src="/assets/excel-app.js"></script>
    <section class="page-head">
      <div><h1>엑셀 대장 동기화</h1><p class="muted">엑셀 파일을 기준으로 전체 문서 대장을 검증하고 안전하게 동기화합니다.</p></div>
      <button type="button" class="button secondary" data-excel-export><i class="fa-solid fa-file-excel"></i> 현재 대장 엑셀 추출</button>
    </section>
    ${error ? alertDanger(error) : ""}
    <section class="panel snapshot-context-grid" aria-label="엑셀 동기화 기준과 권한">
      <div><span>현재 대장 버전</span><strong>V${number(state.currentVersion)}</strong><small>${escapeHtml(state.updatedAt || "초기 상태")} 기준</small></div>
      <div><span>선택 파일 기준 버전</span><strong data-excel-base-version>선택 전</strong><small data-excel-latest>최신 여부 확인 전</small></div>
      <div><span>내보낸 시각</span><strong data-excel-exported-at>선택 전</strong><small>선택 파일을 추출한 시각</small></div>
      <div><span>내 권한</span><strong>검증 가능 · ${canApply ? "적용 가능" : "적용 권한 없음"}</strong><small>${canApply ? "변경사항 검토 후 직접 반영할 수 있습니다." : "검증 후 반영 권한이 있는 담당자에게 요청하세요."}</small></div>
    </section>
    <div class="alert warning" role="note"><strong>일부 변경 목록이 아닌 전체 현재 대장을 올려주세요.</strong><p>파일에서 빠진 문서는 현재 대장에서 제외될 수 있습니다. 파일 선택과 검증만으로는 대장이 바뀌지 않으며, 변경 내역을 확인한 뒤 명시적으로 반영합니다.</p></div>
    ${workflowStepper(1)}
    <section id="excel-full-sync" class="panel snapshot-intro snapshot-upload-panel" data-excel-snapshot data-current-version="${Number(state.currentVersion)}" data-current-snapshot-id="${Number(state.currentSnapshotId || 0)}" data-apply-mode="${escapeHtml(applyMode)}">
      <div>
        <h2>엑셀 전체 동기화</h2>
        <p>최신 대장을 추출해 수정한 파일을 올리세요. 파일 전체를 검증하고 추가·변경·제외 내역을 먼저 보여준 뒤 확인할 때만 반영합니다.</p>
        <form class="stack" data-excel-snapshot-upload data-dirty-form>
          <label>동기화 사유 (10~500자)
            <textarea name="syncReason" required minlength="10" maxlength="500" rows="3" placeholder="예: 2026년 정기 문서고 대장 현행화"></textarea>
          </label>
          <p class="muted">전체 문서 리스트를 변경하는 목적과 근거를 입력하세요. 작업 생성 시 감사 이력에 저장됩니다.</p>
          <label>문서고 관리대장 엑셀
            <input type="file" name="excelFile" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required>
          </label>
          <div class="snapshot-file-summary" data-excel-file-summary hidden></div>
          <div class="alert warning" data-excel-stale-warning hidden>현재 버전보다 오래된 관리 파일입니다. 최신 대장을 다시 내보내 작업하세요. 수정 전 최신 파일을 추출해 주세요.</div>
          <progress class="snapshot-progress" data-excel-progress data-excel-progress-bar aria-label="엑셀 전송 진행률" max="100" value="0" hidden></progress>
          <p class="muted" data-excel-message aria-live="polite">시스템에서 추출한 관리 파일(_시스템정보 포함)을 권장합니다. 일상 변경은 최대 1,000건, 최초 연결은 최대 30,000건이며 시스템이 자동 분할합니다.</p>
          <div class="alert info" data-excel-recovery role="status" hidden></div>
          <fieldset class="snapshot-bootstrap-confirm" data-excel-bootstrap hidden>
            <legend>최초 연결 파일 확인</legend>
            <p class="alert warning">시스템 정보가 없는 파일입니다. 운영 backup과 복구 가능 여부를 확인한 경우에만 최초 연결을 진행하세요.</p>
            <label>확인 문구<input name="bootstrapConfirmation" autocomplete="off" placeholder="BOOTSTRAP" pattern="BOOTSTRAP"></label>
            <label class="checkbox"><input type="checkbox" name="backupConfirmed" value="1"> 운영 backup 생성과 복구 가능 여부를 확인했습니다.</label>
          </fieldset>
          <section class="snapshot-validation-errors" data-excel-errors hidden>
            <div class="section-title"><h3>검증 오류</h3><span class="count-badge" data-excel-error-count>0건</span></div>
            <p class="muted" data-excel-error-summary></p>
            <button type="button" class="button secondary" data-snapshot-errors-csv>오류 CSV 내려받기</button>
            <div class="table-wrap"><table class="doc-table" data-snapshot-error-table>
              <thead><tr><th>행</th><th>필드</th><th>코드</th><th>오류</th></tr></thead><tbody></tbody>
            </table></div>
          </section>
          <button type="submit" class="action-button" data-excel-upload-button>파일 검증 및 변경사항 확인</button>
        </form>
      </div>
    </section>
    <details class="panel snapshot-help"><summary>입력 방법과 운영 도움말</summary>
      <ul class="snapshot-rules">
        <li>오류가 한 건이라도 있으면 현재 문서대장은 변경하지 않습니다.</li>
        <li>랙 위치는 랙과 면에 관계없이 해당 면을 바라본 기준으로 왼쪽부터 1열, 아래부터 1선반을 입력합니다.</li>
        <li>엑셀에서 사라진 문서는 삭제 대신 대장에서 제외해 감사·세트·이동 이력을 보존합니다.</li>
        <li>시스템에서 개별 처리한 추가·정보 수정·개정·위치 이동·폐기는 다음 엑셀 추출과 인쇄용 관리대장에 포함됩니다.</li>
        <li>개정번호는 숫자만 입력하며 화면에서는 Rev.가 붙습니다. 개정번호가 없으면 공란 또는 N/A로 입력하세요. 검색과 다음 추출에는 N/A로 표시됩니다.</li>
        <li>개정 이력의 문서번호·개정번호 변경과 자동 폐기된 이전본의 복원은 엑셀로 처리할 수 없습니다.</li>
        <li>최종 반영은 전용 권한과 위치·폐기 권한이 필요할 수 있습니다.</li>
        <li>추출 후 시스템에서 건별 작업이 발생하면 기존 엑셀은 오래된 파일이 되므로 최신 대장을 다시 추출해야 합니다.</li>
      </ul>
    </details>
    <section class="panel results-panel">
      <div class="section-title"><h2>최근 동기화</h2><span class="count-badge">${snapshots.length}건</span></div>
      <div class="table-wrap"><table class="doc-table">
        <thead><tr><th>작업 번호</th><th>파일</th><th>상태</th><th>문서 수</th><th>추가 / 변경 / 제외</th><th>작업자</th><th>생성일</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="7" class="empty">아직 엑셀 동기화 작업이 없습니다.</td></tr>`}</tbody>
      </table></div>
    </section>
  `, session);
}

export function documentSnapshotDetailPage({
  session,
  snapshot,
  rows = [],
  exclusions = [],
  error = "",
  applied = false,
  scheduled = false,
  canApply = false,
  applyBlockReason = "",
  requiredPermissions = [],
  missingPermissions = [],
  warnings = [],
  validationErrors = [],
  applyMode = "admin-only",
  status = 200
}) {
  const parsedRows = rows.map((row) => ({
    ...row,
    after: parseJson(row.after_json || row.normalized_json),
    before: parseJson(row.before_json),
    changedFields: parseJson(row.changed_fields_json) || [],
    changeFlags: parseJson(row.change_flags_json) || []
  }));
  const bodyRows = parsedRows.map((row) => {
    const values = row.after?.values || {};
    const beforeValues = row.before?.values || {};
    return `
      <tr data-row-filter="${escapeHtml(filterKey(row))}">
        <td data-label="엑셀 행">${number(row.row_number)}</td>
        <td data-label="처리">${flagBadges(row.changeFlags, row.action)}</td>
        <td class="mono" data-label="문서번호">${escapeHtml(values.documentNumber || "-")}</td>
        <td data-label="개정">${escapeHtml(formatRevisionLabel(values.revisionNumber))}</td>
        <td data-label="문서명">${escapeHtml(values.documentName || "-")}</td>
        <td data-label="변경 필드">${escapeHtml((row.changedFields || []).join(", ") || "-")}</td>
        <td data-label="변경 전">${diffCell(beforeValues, row.changedFields)}</td>
        <td data-label="변경 후">${diffCell(values, row.changedFields)}</td>
        <td data-label="현재 위치">${escapeHtml(locationText(beforeValues))}</td>
        <td data-label="변경 위치">${escapeHtml(locationText(values))}</td>
        <td data-label="상태 변화">${escapeHtml(statusText(beforeValues.status))} → ${escapeHtml(statusText(values.status))}</td>
      </tr>`;
  }).join("");
  const exclusionRows = exclusions.map((item) => {
    const before = parseJson(item.before_json);
    const values = before?.values || {};
    const risks = [
      Number(item.set_count || 0) > 0 ? `세트 ${number(item.set_count)}개 연결` : "",
      item.recent_movement_at ? "최근 이동 이력 있음" : ""
    ].filter(Boolean).join(" · ");
    return `
      <tr>
        <td class="mono" data-label="문서번호">${escapeHtml(values.documentNumber || "-")}</td>
        <td data-label="개정">${escapeHtml(formatRevisionLabel(values.revisionNumber))}</td>
        <td data-label="문서명">${escapeHtml(values.documentName || "-")}</td>
        <td data-label="현재 상태">${escapeHtml(statusText(values.status))}</td>
        <td data-label="현재 위치">${escapeHtml(locationText(values))}</td>
        <td data-label="세트">${number(item.set_count)}</td>
        <td data-label="최근 이동">${escapeHtml(item.recent_movement_at || "-")}</td>
        <td data-label="제외 사유">업로드 파일에 행 없음</td>
        <td data-label="위험 정보">${escapeHtml(risks || "-")}</td>
      </tr>`;
  }).join("");
  const notice = applied || snapshot.status === "completed"
    ? `<div class="alert success" role="status">이 엑셀 파일이 현재 문서대장으로 반영되었습니다.</div>`
    : "";
  const bootstrapProgress = Number(snapshot.bootstrap_progress_count || 0);
  const bootstrapTotal = Number(snapshot.total_count || 0);
  const awaitingBootstrapFinalization = bootstrapTotal > 0 && bootstrapProgress === bootstrapTotal;
  const scheduledNotice = snapshot.status === "applying" && snapshot.mode === "bootstrap" && snapshot.bootstrap_apply_actor_json
    ? `<div class="alert info" role="status"><strong>${scheduled ? "최초 대량등록이 예약되었습니다." : awaitingBootstrapFinalization ? "문서 생성이 끝나 공개 확정을 기다리고 있습니다." : "최초 대량등록을 자동 분할 반영 중입니다."}</strong> 1일 최대 5,000건씩 처리하며 현재 ${number(bootstrapProgress)} / ${number(bootstrapTotal)}건입니다.${snapshot.bootstrap_next_run_at ? ` 다음 실행 기준(UTC): ${escapeHtml(snapshot.bootstrap_next_run_at)}` : ""}</div>`
    : "";
  const permissionText = (requiredPermissions || [])
    .map((permission) => PERMISSION_LABELS[permission] || permission)
    .join(", ");
  const missingText = (missingPermissions || [])
    .map((permission) => PERMISSION_LABELS[permission] || permission)
    .join(", ");
  const excludeCount = Number(snapshot.exclude_count || 0);
  const reviewCount = Number(snapshot.create_count || 0) + Number(snapshot.update_count || 0) + excludeCount;
  const warningBlock = (warnings || []).length
    ? `<div class="snapshot-warnings" role="status">${(warnings || []).map((warning) => `
        <div class="alert ${warning.level === "danger" ? "danger" : warning.level === "info" ? "info" : "warning"}">
          <strong>${escapeHtml(warning.code || "WARNING")}</strong>
          ${escapeHtml(warning.message || "")}
        </div>`).join("")}</div>`
    : "";
  return page(`${snapshot.snapshot_code} 엑셀 동기화`, `
    <script defer src="/assets/jszip.min.js"></script>
    <script defer src="/assets/exceljs.min.js"></script>
    <script defer src="/assets/excel-app.js"></script>
    <section class="page-head">
      <div><h1>${escapeHtml(snapshot.snapshot_code)}</h1><p class="muted">${escapeHtml(snapshot.source_name)}</p></div>
      <div class="button-group"><button type="button" class="button secondary" data-excel-export>현재 대장 엑셀 추출</button><a class="button secondary" href="/documents/import">엑셀 대장 동기화</a></div>
    </section>
    ${notice}
    ${scheduledNotice}
    ${error || snapshot.error_summary ? alertDanger(error || snapshot.error_summary) : ""}
    ${applyBlockReason && snapshot.status === "ready" ? alertDanger(applyBlockReason) : ""}
    ${warningBlock}
    ${validationErrorPanel(validationErrors)}
    ${workflowStepper(snapshotStep(snapshot.status))}
    <section class="panel" data-excel-snapshot data-apply-mode="${escapeHtml(applyMode)}">
      <div class="metric-grid snapshot-metrics">
        ${metric("전체", snapshot.total_count)}
        ${metric("신규", snapshot.create_count)}
        ${metric("일반정보", snapshot.metadata_count)}
        ${metric("위치", snapshot.move_count)}
        ${metric("태그", snapshot.tag_change_count)}
        ${metric("폐기", snapshot.dispose_count)}
        ${metric("폐기 해제", snapshot.restore_count)}
        ${metric("유지", snapshot.unchanged_count)}
        ${metric("제외", snapshot.exclude_count)}
        ${metric("재포함", snapshot.reinclude_count)}
        ${metric("Identity 변경", snapshot.identity_change_count)}
      </div>
      <div class="snapshot-apply-row">
        <div>
          <strong>${snapshotStatus(snapshot.status)}</strong>
          <p class="muted">기준 버전 ${number(snapshot.base_version)}${snapshot.canonical_rows_hash ? ` · canonical hash ${escapeHtml(String(snapshot.canonical_rows_hash).slice(0, 12))}…` : ""} · ${escapeHtml(snapshot.created_by_name)} · ${escapeHtml(snapshot.created_at)}</p>
          <p class="muted">필요 권한: ${escapeHtml(permissionText || "문서 관리 + 엑셀 반영")}</p>
          ${missingText ? `<p class="muted">부족 권한: ${escapeHtml(missingText)}</p>` : ""}
          <p><strong>동기화 사유:</strong> ${escapeHtml(snapshot.apply_reason || "미입력(기존 작업)")}</p>
          <details class="snapshot-help"><summary>검증 상세·증적</summary><p class="muted">원본 파일 확인값(브라우저 보고값): <span class="mono">${escapeHtml(snapshot.source_hash || "-")}</span></p></details>
        </div>
      </div>
      ${["staging", "ready"].includes(snapshot.status) ? `
        <form method="post" action="/document-snapshots/${Number(snapshot.id)}/cancel" class="snapshot-cancel-form">
          <button type="submit" class="button danger">반영 전 작업 취소</button>
        </form>` : ""}
    </section>
    <section class="panel results-panel">
      <div class="section-title">
        <h2>행별 변경 내역</h2>
        <span class="count-badge">${rows.length}건</span>
      </div>
      <div class="button-group snapshot-filters" role="group" aria-label="변경 유형 필터">
        ${filterButton("전체", "all", true)}
        ${filterButton("신규", "create")}
        ${filterButton("변경", "update")}
        ${filterButton("위치", "move")}
        ${filterButton("폐기", "dispose")}
        ${filterButton("폐기 해제", "restore")}
        ${filterButton("유지", "unchanged")}
        ${filterButton("오류", "error")}
      </div>
      <div class="table-wrap"><table class="doc-table" data-snapshot-rows>
        <thead><tr>
          <th>엑셀 행</th><th>처리</th><th>문서번호</th><th>개정</th><th>문서명</th>
          <th>변경 필드</th><th>변경 전</th><th>변경 후</th><th>현재 위치</th><th>변경 위치</th><th>상태 변화</th>
        </tr></thead>
        <tbody>${bodyRows || `<tr><td colspan="11" class="empty">표시할 행이 없습니다.</td></tr>`}</tbody>
      </table></div>
    </section>
    <section class="panel results-panel">
      <div class="section-title"><h2>대장 제외 예정</h2><span class="count-badge">${exclusions.length}건</span></div>
      <p class="muted">업로드 파일에 없어 현재 대장에서 제외될 문서입니다. 세트 연결과 감사 이력은 보존됩니다.</p>
      <div class="table-wrap"><table class="doc-table">
        <thead><tr><th>문서번호</th><th>개정</th><th>문서명</th><th>현재 상태</th><th>현재 위치</th><th>세트</th><th>최근 이동</th><th>제외 사유</th><th>위험 정보</th></tr></thead>
        <tbody>${exclusionRows || `<tr><td colspan="9" class="empty">제외 예정 문서가 없습니다.</td></tr>`}</tbody>
      </table></div>
    </section>
    ${canApply ? `<section class="panel snapshot-final-apply" aria-labelledby="snapshot-final-apply-title"><div class="section-title"><h2 id="snapshot-final-apply-title">최종 반영</h2><span class="count-badge">변경 영향 ${number(reviewCount)}건</span></div><p class="muted">위 행별 변경 내역과 대장 제외 예정 목록을 모두 확인한 뒤 반영하세요.</p>${applyForm(snapshot, excludeCount, reviewCount)}</section>` : ""}
    <script>
      (function () {
        var buttons = document.querySelectorAll('[data-snapshot-filter]');
        var rows = document.querySelectorAll('[data-row-filter]');
        buttons.forEach(function (button) {
          button.addEventListener('click', function () {
            var key = button.getAttribute('data-snapshot-filter');
            buttons.forEach(function (item) { var active = item === button; item.classList.toggle('primary', active); item.classList.toggle('secondary', !active); item.setAttribute('aria-pressed', active ? 'true' : 'false'); });
            rows.forEach(function (row) {
              var value = row.getAttribute('data-row-filter') || '';
              row.hidden = key !== 'all' && value.indexOf(key) === -1;
            });
            if (key === 'error') document.querySelector('[data-excel-errors]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        });
      })();
    </script>
  `, session, status);
}

function validationErrorPanel(errors = []) {
  if (!errors.length) return "";
  const rows = errors.map((error, index) => `
    <tr${index >= 20 ? " hidden" : ""}>
      <td data-label="행">${number(error.rowNumber)}</td>
      <td data-label="필드">${escapeHtml(error.field || "-")}</td>
      <td class="mono" data-label="코드">${escapeHtml(error.code || "SNAPSHOT_INVALID_FIELD")}</td>
      <td data-label="오류">${escapeHtml(error.message || "검증 오류")}</td>
    </tr>
  `).join("");
  const remaining = Math.max(0, errors.length - 20);
  return `
    <section class="panel snapshot-validation-errors" data-excel-errors>
      <div class="section-title"><h2>검증 오류</h2><span class="count-badge">${number(errors.length)}건</span></div>
      <p class="muted">앞의 20건을 표시합니다.${remaining ? ` 외 ${number(remaining)}건은 CSV에서 확인하세요.` : ""}</p>
      <button type="button" class="button secondary" data-snapshot-errors-csv>오류 CSV 내려받기</button>
      <div class="table-wrap"><table class="doc-table" data-snapshot-error-table>
        <thead><tr><th>행</th><th>필드</th><th>코드</th><th>오류</th></tr></thead><tbody>${rows}</tbody>
      </table></div>
    </section>`;
}

function applyForm(snapshot, excludeCount, reviewCount) {
  return `
    <form method="post" action="/document-snapshots/${Number(snapshot.id)}/apply" class="stack snapshot-apply-form">
      <label>동기화 사유 확인 (10~500자)
        <textarea name="applyReason" required minlength="10" maxlength="500" rows="3" placeholder="예: 2026년 문서고 정기 대장 현행화">${escapeHtml(snapshot.apply_reason || "")}</textarea>
      </label>
      <label>승인 참조 (조건부 필수)
        <input type="text" name="approvalReference" maxlength="200" placeholder="예: CC-2026-0142">
      </label>
      <p class="muted">적용 건수가 많거나 조직의 변경관리 절차상 사전 승인이 필요한 경우 결재 번호 또는 관련 문서번호를 입력하세요.</p>
      <label>변경 영향 건수 재확인
        <input type="number" name="confirmedReviewCount" required min="${reviewCount}" max="${reviewCount}" value="" inputmode="numeric">
      </label>
      <label class="checkbox"><input type="checkbox" name="confirmReview" value="1" required> 행별 변경과 제외 예정 목록 전체를 검토했습니다.</label>
      ${excludeCount > 0 ? `
        <label>제외 예정 건수 재확인
          <input type="number" name="confirmedExcludeCount" required min="${excludeCount}" max="${excludeCount}" value="">
        </label>
        <label class="checkbox"><input type="checkbox" name="confirmExclude" value="1" required> 제외 ${number(excludeCount)}건을 검토했고 반영에 동의합니다.</label>
      ` : `<input type="hidden" name="confirmedExcludeCount" value="0">`}
      <p class="snapshot-apply-impact" role="note">변경 영향 ${number(reviewCount)}건 · 대장 제외 ${number(excludeCount)}건을 반영합니다. 대장 제외는 문서 폐기와 다릅니다.</p>
      <button type="submit" class="button">현재 대장으로 반영</button>
    </form>
  `;
}

function filterButton(label, key, active = false) {
  return `<button type="button" class="button ${active ? "primary" : "secondary"}" data-snapshot-filter="${escapeHtml(key)}" aria-pressed="${active ? "true" : "false"}">${escapeHtml(label)}</button>`;
}

function filterKey(row) {
  const flags = row.changeFlags || [];
  const parts = [row.action];
  if (flags.includes("MOVE")) parts.push("move");
  if (flags.includes("DISPOSE")) parts.push("dispose");
  if (flags.includes("RESTORE")) parts.push("restore");
  if (flags.includes("CREATE")) parts.push("create");
  if (row.action === "update") parts.push("update");
  if (row.action === "unchanged") parts.push("unchanged");
  return parts.join(" ");
}

function flagBadges(flags = [], action) {
  if (!flags.length) return actionBadge(action);
  return flags.map((flag) => `<span class="status review-pending">${escapeHtml(FLAG_LABELS[flag] || flag)}</span>`).join(" ");
}

function diffCell(values, changedFields = []) {
  if (!changedFields.length) return "-";
  return escapeHtml(changedFields.map((field) => `${field}: ${formatValue(values?.[field])}`).join(" / "));
}

function formatValue(value) {
  if (Array.isArray(value)) return value.join(";");
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function locationText(values = {}) {
  if (!values.rackSlotId && !values.rackCode) return "-";
  const face = values.rackFace === "B" ? "2면" : values.rackFace === "A" ? "1면" : values.rackFace || "";
  return [values.rackCode || values.rackSlotId, values.rackColumn ? `${values.rackColumn}열` : "", values.shelfNumber ? `${values.shelfNumber}선반` : "", face]
    .filter(Boolean)
    .join(" / ");
}

function statusText(status) {
  if (status === "disposed") return "폐기";
  if (status === "active") return "보관중";
  return status || "-";
}

function metric(label, value) {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${number(value)}</strong></div>`;
}

function snapshotStatus(status) {
  const type = status === "failed" ? "snapshot-failed" : status === "cancelled" ? "snapshot-cancelled" : status === "completed" ? "snapshot-completed" : "snapshot-pending";
  return `<span class="status ${type}">${escapeHtml(STATUS_LABELS[status] || status)}</span>`;
}

function snapshotStep(status) {
  if (status === "completed" || status === "applying") return 5;
  if (status === "ready") return 4;
  return 3;
}

function workflowStepper(currentStep = 1) {
  const steps = [
    ["최신 대장 내보내기", "현재 버전 확보"],
    ["업로드", "파일과 사유 입력"],
    ["구조·데이터 검증", "열·버전·행 검사"],
    ["변경 검토", "추가·변경·제외"],
    ["승인·적용", "권한 확인 후 원자 반영"]
  ];
  const safeCurrentStep = Math.min(Math.max(Number(currentStep) || 1, 1), steps.length);
  const [currentLabel, currentCaption] = steps[safeCurrentStep - 1];
  return `<div class="workflow-progress"><ol class="workflow-stepper" aria-label="엑셀 대장 동기화 단계">${steps.map(([label, caption], index) => {
    const step = index + 1;
    const state = step < safeCurrentStep ? "is-complete" : step === safeCurrentStep ? "is-current" : "";
    return `<li class="workflow-step ${state}"${step === safeCurrentStep ? ` aria-current="step"` : ""}><span class="workflow-step-index">${step < safeCurrentStep ? "✓" : step}</span><span class="workflow-step-copy"><strong>${label}</strong><small>${caption}</small></span></li>`;
  }).join("")}</ol><p class="workflow-current-step"><span>현재 단계 ${safeCurrentStep}/${steps.length}</span><strong>${currentLabel}</strong><small>${currentCaption}</small></p></div>`;
}

function actionBadge(action) {
  const type = action === "create" ? "change-created" : action === "update" ? "change-updated" : "change-neutral";
  return `<span class="status ${type}">${escapeHtml(ACTION_LABELS[action] || action)}</span>`;
}

function parseJson(value) {
  try { return JSON.parse(value || "null"); } catch { return null; }
}

function number(value) {
  return Number(value || 0).toLocaleString("ko-KR");
}
