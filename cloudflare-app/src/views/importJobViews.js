import { escapeHtml } from "../ui/html/escape.js";
import { alertDanger, page } from "./layout.js";

const STATUS_LABELS = Object.freeze({ ready: "준비", processing: "처리 중", completed: "완료", cancelled: "취소", pending: "대기", failed: "실패" });

export function documentImportJobsPage({ session, jobs = [] }) {
  const rows = jobs.map((job) => `
    <tr>
      <td class="mono" data-label="작업 번호"><a href="/document-import-jobs/${job.id}">${escapeHtml(job.job_code)}</a></td>
      <td data-label="원본">${escapeHtml(job.source_name || "붙여넣기")}</td>
      <td data-label="상태">${statusLabel(job.status)}</td>
      <td data-label="전체">${number(job.total_count)}</td><td data-label="완료">${number(job.completed_count)}</td><td data-label="실패">${number(job.failed_count)}</td><td data-label="대기">${number(job.pending_count)}</td>
      <td data-label="생성자">${escapeHtml(job.created_by_name)}</td><td data-label="생성일">${escapeHtml(job.created_at)}</td>
    </tr>
  `).join("");
  return page("CSV 가져오기 작업", `
    <section class="page-head"><div><h1>CSV 가져오기 작업</h1><p class="muted">검증된 행을 한 문서씩 처리하고 중단 후 재개합니다.</p></div><a class="button" href="/documents/import">새 가져오기</a></section>
    <section class="panel results-panel">
      <div class="section-title"><h2>작업 목록</h2><span class="count-badge">${jobs.length}건</span></div>
      <div class="table-wrap"><table class="doc-table"><thead><tr><th>작업 번호</th><th>원본</th><th>상태</th><th>전체</th><th>완료</th><th>실패</th><th>대기</th><th>생성자</th><th>생성일</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="9" class="empty">가져오기 작업이 없습니다.</td></tr>`}</tbody></table></div>
    </section>
  `, session);
}

export function documentImportJobCreatePage({ session, error = "", preview = [], csvText = "", sourceName = "" }) {
  const previewRows = preview.map((item) => `<tr>
    <td data-label="CSV 행">${number(item.rowNumber)}</td>
    <td class="mono" data-label="문서번호">${escapeHtml(item.documentNumber)}</td>
    <td data-label="개정">${escapeHtml(item.revisionNumber)}</td>
    <td data-label="문서명">${escapeHtml(item.documentName)}</td>
    <td data-label="대분류">${escapeHtml(item.categoryName)}</td>
    <td data-label="보관 위치">${escapeHtml(item.location)}</td>
    <td data-label="태그">${escapeHtml(item.tags)}</td>
    <td data-label="상태">${escapeHtml(item.status)}</td>
  </tr>`).join("");
  return page("CSV 가져오기", `
    <section class="page-head"><div><h1>문서 대량 등록</h1><p class="muted">최대 50행을 먼저 검증한 뒤 작업으로 저장합니다.</p></div><a class="button secondary" href="/document-import-jobs">작업 목록</a></section>
    <section class="panel${preview.length ? "" : " narrow"}">
      ${error ? alertDanger(error) : ""}
      ${preview.length ? `
        <div class="section-title"><h2>생성 예정 문서 검토</h2><span class="count-badge">${preview.length}건</span></div>
        <p class="muted">정규화된 대분류·보관 위치·상태를 확인하세요. 아직 문서는 생성되지 않았습니다.</p>
        <div class="table-wrap"><table class="doc-table"><thead><tr><th>CSV 행</th><th>문서번호</th><th>개정</th><th>문서명</th><th>대분류</th><th>보관 위치</th><th>태그</th><th>상태</th></tr></thead><tbody>${previewRows}</tbody></table></div>
        <form method="post" action="/document-import-jobs" class="stack import-confirm-form">
          <input type="hidden" name="sourceName" value="${escapeHtml(sourceName)}">
          <textarea name="csvText" hidden>${escapeHtml(csvText)}</textarea>
          <input type="hidden" name="confirmImportPreview" value="1">
          <label class="checkbox"><input type="checkbox" name="confirmImportRows" value="1" required> 위 ${preview.length}건의 생성 예정값을 확인했습니다.</label>
          <div class="button-group"><button type="submit" class="primary">검토한 내용으로 작업 생성</button><a class="button secondary" href="/documents/import/csv">다른 CSV 선택</a></div>
        </form>
      ` : `
        <form method="post" action="/document-import-jobs" class="stack" enctype="multipart/form-data">
          <label>CSV 파일<input type="file" name="csvFile" accept=".csv,text/csv"></label>
          <label>또는 CSV 붙여넣기<textarea name="csvText" rows="10" placeholder="documentNumber,revisionNumber,revisionDate,disposalDueYear,documentName,category,rackCode,rackColumn,shelfNumber,rackFace,tags,note,status"></textarea></label>
          <p class="muted">파일과 붙여넣기 내용을 모두 입력하면 CSV 파일을 우선 사용합니다.</p>
          <button type="submit" class="primary">검증하고 생성 예정값 보기</button>
        </form>
        <p class="muted">필수 열: documentNumber, revisionNumber, documentName, category, rackCode, rackColumn, shelfNumber, rackFace. 랙 위치는 면을 바라본 기준으로 왼쪽부터 1열, 아래부터 1선반입니다.</p>
      `}
    </section>
  `, session);
}

export function documentImportJobDetailPage({ session, job, items = [], itemStatus = "", error = "" }) {
  const rows = items.map((item) => `
    <tr>
      <td data-label="CSV 행">${number(item.row_number)}</td><td data-label="상태">${statusLabel(item.status)}</td>
      <td data-label="생성 문서">${item.created_document_id ? `<a href="/documents/${item.created_document_id}">문서 #${number(item.created_document_id)}</a>` : "-"}</td>
      <td data-label="오류">${escapeHtml(item.error_message || "-")}</td><td data-label="처리 시각">${escapeHtml(item.processed_at || "-")}</td>
    </tr>
  `).join("");
  return page(`${job.job_code} CSV 가져오기`, `
    <section class="page-head">
      <div><h1>문서 가져오기 ${escapeHtml(job.job_code)}</h1><p class="muted">${escapeHtml(job.source_name || "붙여넣기")}</p></div>
      <div class="button-group"><a class="button secondary" href="/document-import-jobs/${job.id}/failures.csv">실패 CSV</a><a class="button secondary" href="/document-import-jobs">목록</a></div>
    </section>
    ${error ? alertDanger(error) : ""}
    <section class="panel">
      <div class="metric-grid" data-import-progress>
        ${metric("전체", job.total_count, "total_count")}${metric("완료", job.completed_count, "completed_count")}${metric("실패", job.failed_count, "failed_count")}${metric("대기", job.pending_count, "pending_count")}
      </div>
      ${jobActions(job)}
      <p class="muted" data-import-message aria-live="polite"></p>
    </section>
    <section class="panel results-panel">
      <div class="section-title"><h2>행 처리 결과</h2><span class="count-badge">${items.length}건</span></div>
      <nav class="filter-row"><a class="button secondary sm" href="/document-import-jobs/${job.id}" ${!itemStatus ? `aria-current="page"` : ""}>전체</a><a class="button secondary sm" href="/document-import-jobs/${job.id}?status=failed" ${itemStatus === "failed" ? `aria-current="page"` : ""}>실패만</a></nav>
      <div class="table-wrap"><table class="doc-table"><thead><tr><th>CSV 행</th><th>상태</th><th>생성 문서</th><th>오류</th><th>처리 시각</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5" class="empty">표시할 행이 없습니다.</td></tr>`}</tbody></table></div>
    </section>
    ${importProcessingScript(job)}
  `, session);
}

function jobActions(job) {
  if (job.status === "ready" || job.status === "processing") {
    return `<div class="button-group"><button type="button" class="button" data-process-import>계속 처리</button><button type="button" class="button secondary" data-stop-import disabled>처리 중단</button><form method="post" action="/document-import-jobs/${job.id}/cancel" data-confirm="작업을 취소하면 이미 생성된 문서는 유지되고 대기 행만 취소됩니다. 이 작업을 취소할까요?"><button type="submit" class="danger-button">작업 취소</button></form></div>`;
  }
  return "";
}

function importProcessingScript(job) {
  if (job.status !== "ready" && job.status !== "processing") return "";
  return `<script>
    (function () {
      var runButton = document.querySelector('[data-process-import]');
      var stopButton = document.querySelector('[data-stop-import]');
      var message = document.querySelector('[data-import-message]');
      var csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
      var running = false;
      function update(job) {
        ['total_count','completed_count','failed_count','pending_count'].forEach(function (key) {
          var node = document.querySelector('[data-import-value="' + key + '"]');
          if (node) node.textContent = String(job[key] || 0);
        });
      }
      async function processNext() {
        while (running) {
          var response = await fetch('/document-import-jobs/${Number(job.id)}/process', {
            method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ csrf_token: csrf })
          });
          var result = await response.json();
          if (!response.ok || !result.ok) throw new Error(result.message || '처리를 계속할 수 없습니다.');
          update(result.job || {});
          if (result.done) { message.textContent = '가져오기가 완료되었습니다.'; window.location.reload(); return; }
          message.textContent = result.failed ? '실패한 행을 기록하고 다음 행을 처리합니다.' : '한 문서를 등록했습니다.';
        }
      }
      runButton?.addEventListener('click', function () {
        if (running) return;
        running = true; runButton.disabled = true; stopButton.disabled = false;
        processNext().catch(function (error) { running = false; runButton.disabled = false; stopButton.disabled = true; message.textContent = error.message + ' 나중에 재개할 수 있습니다.'; });
      });
      stopButton?.addEventListener('click', function () { running = false; runButton.disabled = false; stopButton.disabled = true; message.textContent = '처리를 중단했습니다. 완료된 행은 저장되었습니다.'; });
    })();
  </script>`;
}

function statusLabel(status) {
  const type = status === "failed" ? "import-failed" : status === "cancelled" ? "import-cancelled" : status === "completed" ? "import-completed" : "import-pending";
  return `<span class="status ${type}">${escapeHtml(STATUS_LABELS[status] || status)}</span>`;
}

function metric(label, value, key) {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong data-import-value="${key}">${number(value)}</strong></div>`;
}

function number(value) {
  return Number(value || 0).toLocaleString("ko-KR");
}
