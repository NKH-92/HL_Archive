// 문서 작업 공간: 명시적 빠른 보기와 탭 단위 검색 복귀.
export function workspaceInteractionScript() {
  return `      var workspaceSearch = document.querySelector('[data-viewer-form] input[name="q"]');
      var workspacePreview = document.querySelector('[data-document-preview]');
      var workspace = document.querySelector('[data-viewer-app]');
      var previewTrigger = null;
      var previewInline = false;
      var previewInlineMinimum = Number.parseFloat(window.getComputedStyle?.(document.documentElement).getPropertyValue('--preview-inline-min')) || 1040;
      var comparisonToggle = document.querySelector('[data-comparison-toggle]');
      if (comparisonToggle && workspace) {
        comparisonToggle.checked = false;
        workspace.classList.toggle('is-comparison', comparisonToggle.checked);
        comparisonToggle.addEventListener('change', function () {
          workspace.classList.toggle('is-comparison', comparisonToggle.checked);
        });
      }
      var columnToggle = document.querySelector('[data-column-toggle="revision-date"]');
      var applyRevisionColumn = function (visible) {
        document.querySelectorAll('[data-column="revision-date"]').forEach(function (cell) { cell.hidden = !visible; });
        document.querySelectorAll('.viewer-result-table').forEach(function (table) { table.classList.toggle('show-revision-date', visible); });
        if (columnToggle) columnToggle.checked = visible;
      };
      if (columnToggle) {
        try { applyRevisionColumn(localStorage.getItem('hanlimDocumentColumns') === 'revision-date'); } catch {}
        columnToggle.addEventListener('change', function () {
          applyRevisionColumn(columnToggle.checked);
          try { localStorage.setItem('hanlimDocumentColumns', columnToggle.checked ? 'revision-date' : ''); } catch {}
        });
      }
      var closePreview = function (restoreFocus) {
        if (!workspacePreview) return;
        if (workspacePreview.open) workspacePreview.close();
        workspace?.classList.remove('has-preview');
        document.querySelectorAll('.is-previewed').forEach(function (row) { row.classList.remove('is-previewed'); });
        document.querySelectorAll('[data-preview-open]').forEach(function (button) { button.setAttribute('aria-expanded', 'false'); });
        if (restoreFocus && previewTrigger?.isConnected) previewTrigger.focus();
      };
      var sizePreview = function () {
        if (!workspace || !workspacePreview?.open) return;
        var inline = workspace.getBoundingClientRect().width >= previewInlineMinimum;
        if (inline === previewInline) return;
        workspacePreview.close();
        previewInline = inline;
        workspacePreview.classList.toggle('is-inline', inline);
        workspace.classList.toggle('has-preview', inline);
        if (inline) workspacePreview.show(); else workspacePreview.showModal();
      };
      if (workspacePreview) {
        workspacePreview.addEventListener('cancel', function (event) { event.preventDefault(); closePreview(true); });
        window.addEventListener('resize', sizePreview);
      }
      document.addEventListener('hanlim:search-change', function () { closePreview(false); });
      document.addEventListener('click', function (event) {
        var target = event.target instanceof Element ? event.target : null;
        if (target?.closest('[data-preview-close]')) { closePreview(true); return; }
        var button = target?.closest('[data-preview-open]');
        var row = button?.closest('[data-document-row]');
        if (row && workspacePreview) {
          closePreview(false);
          previewTrigger = button;
          [['name', 'documentName'], ['number', 'documentNumber'], ['category', 'documentCategory'], ['location', 'documentLocation'], ['status', 'documentStatus']].forEach(function (pair) {
            var element = workspacePreview.querySelector('[data-preview-' + pair[0] + ']');
            if (element) element.textContent = row.dataset[pair[1]] || '-';
          });
          workspacePreview.querySelector('[data-preview-number]').textContent += ' · ' + row.dataset.documentRevision;
          workspacePreview.querySelector('[data-preview-link]').href = row.dataset.documentUrl;
          var rack = workspacePreview.querySelector('[data-preview-rack]');
          rack.replaceChildren();
          var corner = document.createElement('span'); rack.appendChild(corner);
          for (var rackColumn = 1; rackColumn <= 7; rackColumn += 1) {
            var axis = document.createElement('span'); axis.className = 'preview-rack-axis'; axis.textContent = rackColumn + '열'; rack.appendChild(axis);
          }
          for (var shelf = 6; shelf >= 1; shelf -= 1) {
            var shelfAxis = document.createElement('span'); shelfAxis.className = 'preview-rack-axis'; shelfAxis.textContent = shelf; shelfAxis.setAttribute('aria-label', shelf + '선반'); rack.appendChild(shelfAxis);
            for (var column = 1; column <= 7; column += 1) {
              var slot = document.createElement('span');
              var active = column === Number(row.dataset.documentColumn) && shelf === Number(row.dataset.documentShelf);
              slot.className = 'preview-slot' + (active ? ' is-active' : '');
              slot.textContent = active ? '●' : '';
              slot.title = column + '열 ' + shelf + '선반';
              slot.setAttribute('aria-label', column + '열 ' + shelf + '선반' + (active ? ' 선택 위치' : ''));
              rack.appendChild(slot);
            }
          }
          previewInline = workspace.getBoundingClientRect().width >= previewInlineMinimum;
          workspacePreview.classList.toggle('is-inline', previewInline);
          workspace.classList.toggle('has-preview', previewInline);
          if (previewInline) workspacePreview.show(); else workspacePreview.showModal();
          row.classList.add('is-previewed');
          button.setAttribute('aria-expanded', 'true');
        }
        var detailLink = target?.closest('[data-doc-click], [data-preview-link]');
        if (detailLink && workspace) {
          var sourceRow = detailLink.closest('[data-document-row]') || previewTrigger?.closest('[data-document-row]');
          if (!sourceRow) return;
          var state = { url: location.pathname + location.search, id: Number(sourceRow.dataset.documentId), count: document.querySelectorAll('[data-document-row]').length, scroll: window.scrollY, time: Date.now() };
          try { sessionStorage.setItem('hanlimSearchReturn:' + (document.body.dataset.navigationScope || ''), JSON.stringify(state)); } catch {}
        }
      });
      document.addEventListener('keydown', function (event) {
        var editing = event.target?.matches?.('input, textarea, select, [contenteditable="true"]');
        if (event.key === '/' && !editing && workspaceSearch && !workspacePreview?.open) {
          event.preventDefault(); workspaceSearch.focus(); workspaceSearch.select();
        }
        if (event.key === 'Escape' && workspacePreview?.open) closePreview(true);
      });
      window.addEventListener('pageshow', function (event) {
        if (!event.persisted || !workspace) return;
        document.querySelectorAll('[data-bulk-item]').forEach(function (item) { item.checked = false; });
        closePreview(false); syncBulk();
        // 뒤로가기 캐시의 과거 행을 사용하지 않고 최신 조회 경로에서 복원한다.
        location.reload();
      });
      // 모바일 고정 저장 바는 폼이 화면에 있을 때만 떠 있어야 한다. 폼을 완전히 지나가면
      // 흐름으로 되돌려 뒤따르는 내용을 가리지 않는다.
      var mobileSaveBar = document.querySelector('[data-save-bar]');
      var saveBarForm = mobileSaveBar ? mobileSaveBar.closest('form') : null;
      if (mobileSaveBar && saveBarForm) {
        var syncSaveBar = function () {
          var narrow = window.matchMedia?.('(max-width: 760px)').matches ?? false;
          var bounds = saveBarForm.getBoundingClientRect();
          var parked = narrow && bounds.bottom <= 0;
          mobileSaveBar.toggleAttribute('data-save-bar-parked', parked);
        };
        syncSaveBar();
        window.addEventListener('scroll', syncSaveBar, { passive: true });
        window.addEventListener('resize', syncSaveBar);
      }
`;
}
