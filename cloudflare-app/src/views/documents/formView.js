// 문서 등록·수정 폼. 위치 선택기와 스크립트 삽입 순서를 그대로 유지한다.

import { escapeHtml } from "../../ui/html/escape.js";
import { locationPicker, locationPickerScript } from "../documentLocationPicker.js";
import { formValue, option, page } from "../layout.js";

export function documentFormPage({
  session,
  title,
  action,
  values = {},
  categories,
  tags,
  slots,
  selectedTags = [],
  error = "",
  validation = null,
  showLocation = true,
  mode = "create"
}) {
  const normalizedValidation = normalizeValidation(validation, error);
  const cancelUrl = formCancelUrl(action, values);
  const isInformationEdit = mode === "information";
  const submitLabel = isInformationEdit ? "정보 저장" : "등록";
  const noteLabel = title === "새 개정 등록" ? "필요한 변경사항" : "비고";
  return page(title, `
    <section class="page-head"><h1>${escapeHtml(title)}</h1></section>
    <section class="document-form-layout" data-document-form-layout>
      <form method="post" action="${escapeHtml(action)}" class="panel document-form" data-document-form data-current-revision="${escapeHtml(formValue(values, "revisionNumber", "revision_number"))}">
        ${formErrorSummary(normalizedValidation, title)}
        ${duplicateNotice(normalizedValidation.duplicate)}
        <p class="duplicate-check-status muted" data-duplicate-check-status role="status" aria-live="polite"></p>
        ${formValue(values, "returnTo", "return_to") ? `<input type="hidden" name="returnTo" value="${escapeHtml(formValue(values, "returnTo", "return_to"))}">` : ""}
        ${formValue(values, "updatedAt", "updated_at") ? `<input type="hidden" name="expectedUpdatedAt" value="${escapeHtml(formValue(values, "updatedAt", "updated_at"))}">` : ""}
        ${formValue(values, "rowVersion", "row_version") ? `<input type="hidden" name="expectedRowVersion" value="${escapeHtml(formValue(values, "rowVersion", "row_version"))}">` : ""}
        ${values.revisionSourceId ? `<input type="hidden" name="revisionSourceId" value="${Number(values.revisionSourceId)}">` : ""}

        <fieldset class="form-section">
          <legend>문서 정보</legend>
          <div class="form-grid two-column">
            ${textField("documentNumber", "문서번호", formValue(values, "documentNumber", "document_number"), normalizedValidation, { required: true, mono: true })}
            ${isInformationEdit
              ? lockedField("개정번호", formValue(values, "revisionNumber", "revision_number"))
              : textField("revisionNumber", "개정번호", formValue(values, "revisionNumber", "revision_number") || "Rev.0", normalizedValidation, { required: true })}
          </div>
          ${textField("documentName", "문서명", formValue(values, "documentName", "document_name"), normalizedValidation, { required: true })}
          <label for="field-categoryId">대분류 <em>*</em>
            <select id="field-categoryId" name="categoryId" required ${errorAttrs("categoryId", normalizedValidation)}>
              <option value="">대분류 선택</option>
              ${categories.map((category) => option(category.id, category.name, formValue(values, "categoryId", "category_id"))).join("")}
            </select>
          </label>
          ${fieldError("categoryId", normalizedValidation)}
          <div class="tag-picker" data-tag-picker>
            <label class="tag-search"><span>태그 검색</span><input type="search" data-tag-search placeholder="태그 이름으로 찾기" autocomplete="off"></label>
            <p class="muted" data-tag-count aria-live="polite"></p>
            <fieldset id="field-tagIds" class="check-grid form-tags" tabindex="-1">
              <legend>태그 다중 선택</legend>
              ${tags.map((tag) => `<label class="check-item" data-tag-option data-tag-name="${escapeHtml(tag.name)}"><input type="checkbox" name="tagIds" value="${tag.id}" ${selectedTags.includes(tag.id) ? "checked" : ""}><span>${escapeHtml(tag.name)}</span></label>`).join("")}
            </fieldset>
          </div>
          ${fieldError("tagIds", normalizedValidation)}
        </fieldset>

        <fieldset class="form-section">
          <legend>보존 정보</legend>
          <div class="form-grid two-column">
            ${isInformationEdit
              ? lockedField("제·개정일", formValue(values, "revisionDate", "revision_date") || "미입력")
              : textField("revisionDate", "제·개정일", formValue(values, "revisionDate", "revision_date"), normalizedValidation, { required: true, type: "date" })}
            ${textField("disposalDueYear", "폐기 예정 연도", formValue(values, "disposalDueYear", "disposal_due_year"), normalizedValidation, { required: true, type: "number", extra: 'min="1900" max="9999" step="1"' })}
          </div>
        </fieldset>

        ${showLocation ? `<fieldset class="form-section">
          <legend>보관 위치</legend>
          ${locationPicker(slots, formValue(values, "rackSlotId", "rack_slot_id"), normalizedValidation.fieldErrors?.rackSlotId)}
          <label for="field-rackFace">보관 면 <em>*</em>
            <select id="field-rackFace" name="rackFace" required data-rack-face ${errorAttrs("rackFace", normalizedValidation)}>${option("A", "1면", formValue(values, "rackFace", "rack_face") || "A")}${option("B", "2면", formValue(values, "rackFace", "rack_face"))}</select>
          </label>
          ${fieldError("rackFace", normalizedValidation)}
          <p class="muted" data-face-hint>양면 랙은 13-1(1면)/13-2(2면)처럼 면 단위로 표기합니다. 모든 면은 바라본 기준으로 왼쪽부터 1열, 아래부터 1선반입니다.</p>
          <div class="location-selection-preview" data-location-selection aria-live="polite">
            <div><span>선택 위치</span><strong data-location-selection-label>위치를 선택하세요.</strong></div>
            <div><span>활성 문서</span><strong data-location-selection-count>-</strong></div>
            <a class="button secondary sm" data-location-selection-link href="/app" hidden>같은 위치 문서 보기</a>
          </div>
        </fieldset>` : ""}

        <section class="form-section form-note-section" aria-labelledby="note-title">
          <h2 id="note-title">${noteLabel}</h2>
          <label class="sr-only" for="field-note">${noteLabel}</label>
          <textarea id="field-note" name="note" rows="3" ${errorAttrs("note", normalizedValidation)}>${escapeHtml(formValue(values, "note", "note"))}</textarea>
          ${fieldError("note", normalizedValidation)}
        </section>

        <div class="form-actions sticky-save-bar" data-save-bar>
          <div class="form-completion"><strong data-form-completion>필수 입력 0/0</strong><progress data-form-completion-bar max="100" value="0" aria-label="필수 입력 완료도"></progress></div>
          <div class="button-group"><a class="button secondary" href="${escapeHtml(cancelUrl)}">취소</a><button type="submit" class="primary">${submitLabel}</button></div>
        </div>
      </form>

      <details class="panel form-review" data-form-review>
        <summary>${isInformationEdit ? "정보 수정 내용 확인" : "등록 내용 확인"}</summary>
        <dl>
          <div><dt>문서번호</dt><dd class="mono" data-summary="documentNumber">-</dd></div>
          <div><dt>개정번호</dt><dd data-summary="revisionNumber">${isInformationEdit ? escapeHtml(formValue(values, "revisionNumber", "revision_number")) : "-"}</dd></div>
          <div><dt>문서명</dt><dd data-summary="documentName">-</dd></div>
          <div><dt>대분류</dt><dd data-summary="categoryId">-</dd></div>
          <div><dt>제·개정일</dt><dd data-summary="revisionDate">${isInformationEdit ? escapeHtml(formValue(values, "revisionDate", "revision_date") || "미입력") : "-"}</dd></div>
          <div><dt>폐기 예정</dt><dd data-summary="disposalDueYear">-</dd></div>
          ${showLocation ? `<div><dt>보관 위치</dt><dd class="mono" data-summary="location">-</dd></div>` : ""}
        </dl>
      </details>
    </section>
    ${showLocation ? locationPickerScript() : ""}
    ${documentFormScript(showLocation)}
  `, session);
}

function normalizeValidation(validation, error) {
  if (validation && typeof validation === "object") {
    return { fieldErrors: validation.fieldErrors || {}, formErrors: validation.formErrors || [], duplicate: validation.duplicate || null };
  }
  return { fieldErrors: {}, formErrors: error ? [String(error)] : [], duplicate: null };
}

function textField(name, label, value, validation, { required = false, mono = false, type = "text", extra = "" } = {}) {
  return `<div class="field-group"><label for="field-${name}">${escapeHtml(label)}${required ? " <em>*</em>" : ""}<input id="field-${name}" class="${mono ? "mono-input" : ""}" type="${type}" name="${name}" value="${escapeHtml(value)}" ${required ? "required" : ""} ${extra} ${errorAttrs(name, validation)}></label>${fieldError(name, validation)}</div>`;
}

function lockedField(label, value) {
  return `<div class="field-group locked-field"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "-")}</strong><small>문서 개정에서만 변경할 수 있습니다.</small></div>`;
}

function errorAttrs(name, validation) {
  return validation.fieldErrors?.[name] ? `aria-invalid="true" aria-describedby="error-${name}"` : "";
}

function fieldError(name, validation) {
  const message = validation.fieldErrors?.[name];
  return message ? `<p class="field-error" id="error-${name}">${escapeHtml(message)}</p>` : "";
}

function formErrorSummary(validation, title) {
  const entries = Object.entries(validation.fieldErrors || {});
  const formErrors = validation.formErrors || [];
  const total = entries.length + formErrors.length;
  if (!total) return "";
  return `<div class="form-error-summary" role="alert" tabindex="-1" data-error-summary><strong>${title === "정보 수정" ? "문서 정보를 수정하지 못했습니다." : "문서를 등록하지 못했습니다."}</strong><p>아래 ${total}개 항목을 확인하세요.</p><ul>${entries.map(([name, message]) => `<li><a href="#field-${escapeHtml(name)}">${escapeHtml(message)}</a></li>`).join("")}${formErrors.map((message) => `<li>${escapeHtml(message)}</li>`).join("")}</ul></div>`;
}

function duplicateNotice(duplicate) {
  const document = duplicate?.document;
  return `<div class="duplicate-notice" data-duplicate-notice role="status" ${document ? "" : "hidden"}><strong>이미 등록된 문서입니다.</strong><p><span class="mono" data-duplicate-code>${document ? `${escapeHtml(document.documentNumber)} / ${escapeHtml(document.revisionNumber)}` : ""}</span><br><span data-duplicate-name>${document ? escapeHtml(document.documentName) : ""}</span> · <span data-duplicate-status>${document ? (document.status === "active" ? "보관중" : "폐기") : ""}</span></p><a class="button secondary sm" data-duplicate-link href="${document ? `/documents/${Number(document.id)}` : "#"}">기존 문서 보기</a></div>`;
}

function formCancelUrl(action, values) {
  if (values.revisionSourceId) return `/documents/${Number(values.revisionSourceId)}`;
  const match = String(action).match(/^\/documents\/(\d+)\/edit$/);
  return match ? `/documents/${match[1]}` : "/app";
}

function documentFormScript(showLocation) {
  return `<script>(function () {
    var form = document.querySelector('[data-document-form]');
    if (!form) return;
    var formReview = document.querySelector('[data-form-review]');
    if (formReview) formReview.open = !window.matchMedia('(max-width: 760px)').matches;
    var summary = function (name, value) {
      var target = document.querySelector('[data-summary="' + name + '"]');
      if (target) target.textContent = value || '-';
    };
    var updateSummary = function () {
      ['documentNumber', 'revisionNumber', 'documentName', 'revisionDate'].forEach(function (name) {
        var input = form.elements[name]; if (input) summary(name, input.value.trim());
      });
      var year = form.elements.disposalDueYear ? form.elements.disposalDueYear.value.trim() : '';
      summary('disposalDueYear', year ? year + '년' : '');
      var category = form.elements.categoryId;
      summary('categoryId', category && category.selectedIndex > 0 ? category.options[category.selectedIndex].textContent : '');
      ${showLocation ? `var slot = form.elements.rackSlotId;
      var face = form.elements.rackFace;
      var location = slot && slot.value ? slot.options[slot.selectedIndex].textContent : '';
      if (location && face && !face.options[face.selectedIndex].disabled) location += ' · ' + face.options[face.selectedIndex].textContent;
      summary('location', location);` : ""}
    };
    form.addEventListener('input', updateSummary);
    form.addEventListener('change', updateSummary);
    updateSummary();

    var tagSearch = form.querySelector('[data-tag-search]');
    var tagOptions = Array.prototype.slice.call(form.querySelectorAll('[data-tag-option]'));
    var tagCount = form.querySelector('[data-tag-count]');
    var updateTagCount = function () {
      if (!tagCount) return;
      var selected = tagOptions.filter(function (item) { return item.querySelector('input').checked; }).length;
      var visible = tagOptions.filter(function (item) { return !item.hidden; }).length;
      tagCount.textContent = '선택 ' + selected + '개 · 표시 ' + visible + '개';
    };
    tagSearch?.addEventListener('input', function () {
      var query = tagSearch.value.trim().toLocaleLowerCase('ko-KR');
      tagOptions.forEach(function (item) {
        item.hidden = Boolean(query) && (item.getAttribute('data-tag-name') || '').toLocaleLowerCase('ko-KR').indexOf(query) === -1;
      });
      updateTagCount();
    });
    tagOptions.forEach(function (item) { item.querySelector('input')?.addEventListener('change', updateTagCount); });
    updateTagCount();

    var requiredInputs = function () {
      return Array.prototype.slice.call(form.querySelectorAll('[required]')).filter(function (input) {
        return !input.disabled && input.type !== 'hidden';
      });
    };
    var updateCompletion = function () {
      var inputs = requiredInputs();
      var completed = inputs.filter(function (input) {
        if (input.type === 'checkbox' || input.type === 'radio') return input.checked;
        return Boolean(String(input.value || '').trim()) && input.checkValidity();
      }).length;
      var label = form.querySelector('[data-form-completion]');
      var bar = form.querySelector('[data-form-completion-bar]');
      if (label) label.textContent = '필수 입력 ' + completed + '/' + inputs.length;
      if (bar) bar.value = inputs.length ? Math.round(completed / inputs.length * 100) : 100;
    };
    var updateLocationSelection = function () {
      var slot = form.elements.rackSlotId;
      var face = form.elements.rackFace;
      var selected = slot && slot.selectedIndex >= 0 ? slot.options[slot.selectedIndex] : null;
      var label = form.querySelector('[data-location-selection-label]');
      var count = form.querySelector('[data-location-selection-count]');
      var link = form.querySelector('[data-location-selection-link]');
      if (!selected || !selected.value) {
        if (label) label.textContent = '위치를 선택하세요.';
        if (count) count.textContent = '-';
        if (link) link.hidden = true;
        return;
      }
      var selectedFace = face && face.value === 'B' ? 'B' : 'A';
      var activeCount = Number(selected.getAttribute(selectedFace === 'B' ? 'data-active-b' : 'data-active-a') || 0);
      if (label) label.textContent = selected.textContent.trim() + (selected.getAttribute('data-single-sided') === '1' ? '' : ' · ' + (selectedFace === 'B' ? '2면' : '1면'));
      if (count) count.textContent = activeCount.toLocaleString('ko-KR') + '건';
      if (link) {
        var params = new URLSearchParams({
          status: 'active',
          sort: 'location',
          rack: selected.getAttribute('data-rack-id') || '',
          face: selectedFace,
          column: selected.getAttribute('data-column') || '',
          shelf: selected.getAttribute('data-shelf') || ''
        });
        link.href = '/app?' + params.toString();
        link.hidden = false;
      }
    };
    var dirty = false;
    var markDirty = function () {
      dirty = true;
      updateCompletion();
      updateLocationSelection();
    };
    form.addEventListener('input', markDirty);
    form.addEventListener('change', markDirty);
    form.addEventListener('submit', function () { dirty = false; });
    window.addEventListener('beforeunload', function (event) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    });
    updateCompletion();
    updateLocationSelection();

    var numberInput = form.elements.documentNumber;
    var revisionInput = form.elements.revisionNumber;
    var notice = document.querySelector('[data-duplicate-notice]');
    var duplicateStatus = document.querySelector('[data-duplicate-check-status]');
    var timer = 0;
    var requestId = 0;
    var checkDuplicate = function () {
      clearTimeout(timer);
      var current = ++requestId;
      var number = numberInput ? numberInput.value.trim() : '';
      var revision = revisionInput ? revisionInput.value.trim() : (form.dataset.currentRevision || '');
      if (!number || !revision || !notice) { if (notice) notice.hidden = true; if (duplicateStatus) duplicateStatus.textContent = ''; return; }
      timer = setTimeout(function () {
        if (duplicateStatus) duplicateStatus.textContent = '중복 문서를 확인하는 중입니다.';
        var params = new URLSearchParams({ documentNumber: number, revisionNumber: revision });
        var editMatch = form.getAttribute('action').match(/^\\/documents\\/(\\d+)\\/edit$/);
        if (editMatch) params.set('excludeId', editMatch[1]);
        fetch('/api/documents/duplicate?' + params.toString(), { headers: { Accept: 'application/json' } })
          .then(function (response) { if (!response.ok) throw new Error('duplicate-check'); return response.json(); })
          .then(function (result) {
            if (current !== requestId) return;
            if (duplicateStatus) duplicateStatus.textContent = result.exists ? '동일 문서가 확인되었습니다.' : '등록 가능한 문서번호와 개정번호입니다.';
            if (!result.exists || !result.document) { notice.hidden = true; return; }
            notice.hidden = false;
            notice.querySelector('[data-duplicate-code]').textContent = result.document.documentNumber + ' / ' + result.document.revisionNumber;
            notice.querySelector('[data-duplicate-name]').textContent = result.document.documentName;
            notice.querySelector('[data-duplicate-status]').textContent = result.document.status === 'active' ? '보관중' : '폐기';
            notice.querySelector('[data-duplicate-link]').href = '/documents/' + result.document.id;
          }).catch(function () {
            if (current !== requestId) return;
            notice.hidden = true;
            if (duplicateStatus) duplicateStatus.textContent = '중복 확인을 완료하지 못했습니다. 제출 시 서버에서 다시 확인합니다.';
          });
      }, 300);
    };
    if (numberInput) numberInput.addEventListener('input', checkDuplicate);
    if (revisionInput) revisionInput.addEventListener('input', checkDuplicate);
    var errorSummary = document.querySelector('[data-error-summary]');
    if (errorSummary) errorSummary.focus();
  })();</script>`;
}
