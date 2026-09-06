// 입력은 메모리에만 유지한다. 실패한 저장을 자동으로 재전송하지 않는다.
export function formFeedbackScript() {
  return `      document.querySelectorAll('[data-document-form], [data-revision-form], [data-movement-form], [data-dirty-form]').forEach(function (form) {
        if (form.hasAttribute('data-demo-disabled')) return;
        var dirty = false;
        var saving = false;
        form.addEventListener('input', function () { dirty = true; });
        form.addEventListener('change', function () { dirty = true; });
        window.addEventListener('beforeunload', function (event) {
          if (!dirty && !saving) return;
          event.preventDefault(); event.returnValue = '';
        });
        if (form.hasAttribute('data-dirty-form')) {
          document.addEventListener('hanlim:form-saved', function () { dirty = false; });
          return;
        }
        form.addEventListener('submit', async function (event) {
          if (event.defaultPrevented) return;
          event.preventDefault();
          if (saving) return;
          var data = new FormData(form);
          if (event.submitter?.name) data.set(event.submitter.name, event.submitter.value);
          var controls = Array.from(form.querySelectorAll('input, select, textarea, button')).map(function (control) { return [control, control.disabled]; });
          var feedback = form.querySelector('[data-save-feedback]');
          if (!feedback) {
            feedback = document.createElement('div'); feedback.dataset.saveFeedback = ''; feedback.className = 'alert info'; feedback.tabIndex = -1; form.prepend(feedback);
          }
          feedback.setAttribute('role', 'status'); feedback.textContent = '저장 중입니다…';
          saving = true; form.setAttribute('aria-busy', 'true');
          controls.forEach(function (entry) { entry[0].disabled = true; });
          var restoreControls = function () { controls.forEach(function (entry) { entry[0].disabled = entry[1]; }); saving = false; form.setAttribute('aria-busy', 'false'); };
          var controller = new AbortController();
          var timeout = setTimeout(function () { controller.abort(); }, 30000);
          try {
            var response = await fetch(form.action, { method: 'POST', body: data, credentials: 'same-origin', signal: controller.signal });
            if (response.redirected && response.ok && new URL(response.url).origin === location.origin && !new URL(response.url).pathname.startsWith('/login')) {
              dirty = false; saving = false; location.assign(response.url); return;
            }
            var parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
            var summary = parsed.querySelector('[data-error-summary], .form-error-summary, .alert.danger');
            if (!summary || response.status >= 500 || response.redirected) throw new Error('save-unknown');
            restoreControls();
            form.querySelectorAll('[aria-invalid="true"]').forEach(function (field) { field.removeAttribute('aria-invalid'); });
            feedback.className = 'form-error-summary'; feedback.setAttribute('role', 'alert'); feedback.replaceChildren();
            var message = document.createElement('p'); message.textContent = summary.textContent.trim(); feedback.appendChild(message);
            parsed.querySelectorAll('[aria-invalid="true"]').forEach(function (field) {
              var current = document.getElementById(field.id);
              if (!current || !form.contains(current)) return;
              current.setAttribute('aria-invalid', 'true');
              var link = document.createElement('a'); link.href = '#' + field.id;
              var label = parsed.querySelector('label[for="' + field.id + '"]');
              link.textContent = (label?.textContent || field.name) + ' 확인'; feedback.appendChild(link);
            });
            var latest = document.createElement('a');
            latest.href = form.action.replace(/\\/(edit|revise|move)$/, ''); latest.target = '_blank'; latest.rel = 'noopener'; latest.textContent = '최신 내용 별도 확인'; feedback.appendChild(latest);
            feedback.focus();
          } catch {
            feedback.className = 'form-error-summary'; feedback.setAttribute('role', 'alert');
            feedback.textContent = '저장 결과를 확인하지 못했습니다. 입력은 유지했습니다. 다른 탭에서 저장 여부를 먼저 확인하세요. 자동으로 다시 저장하지 않습니다.';
            var check = document.createElement('a'); check.href = '/app'; check.target = '_blank'; check.rel = 'noopener'; check.textContent = '문서 검색으로 저장 여부 확인'; feedback.appendChild(check);
            var resume = document.createElement('button'); resume.type = 'button'; resume.className = 'button secondary'; resume.textContent = '저장되지 않은 것을 확인했습니다';
            resume.addEventListener('click', function () { restoreControls(); resume.remove(); }); feedback.appendChild(resume);
            feedback.focus();
          } finally { clearTimeout(timeout); }
        });
      });
      var revisionField = document.querySelector('[data-revision-form] [name="revisionNumber"]');
      if (revisionField) revisionField.addEventListener('input', function () {
        var summary = document.querySelector('[data-new-revision]');
        if (summary) summary.textContent = revisionField.value ? 'Rev.' + revisionField.value.replace(/^Rev\\./i, '') : '신규 개정 입력';
      });
`;
}
