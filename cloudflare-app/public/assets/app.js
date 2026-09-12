// generated from src/views/clientScript.js; do not edit
(() => {
// 서버와 정적 브라우저 자산이 공유하는 문서 결과 마크업. 사용자 값은 전달받은 escape로 처리한다.
function resultRow(item, { selectable = false, selected = false, query = "", returnTo = "/app" } = {}, escape, highlight) {
  const id = Number(item.id);
  const name = item.documentName || "문서명 없음";
  const number = item.documentNumber || "";
  const rawRevision = item.revisionLabel || item.revisionNumber;
  const revision = rawRevision === null || rawRevision === undefined || rawRevision === "" ? "N/A" : /^Rev\./i.test(String(rawRevision)) ? String(rawRevision) : `Rev.${rawRevision}`;
  const location = item.location || {};
  const label = location.label || "위치 미지정";
  const url = `/documents/${id}?returnTo=${encodeURIComponent(returnTo)}`;
  const disposed = item.status === "disposed";
  return `<tr class="viewer-result-row${disposed ? " is-disposed" : ""}" data-document-row data-document-id="${id}" data-document-url="${escape(url)}" data-document-name="${escape(name)}" data-document-number="${escape(number)}" data-document-revision="${escape(revision)}" data-document-category="${escape(item.categoryName || "-")}" data-document-location="${escape(label)}" data-document-status="${disposed ? "폐기" : "보관중"}" data-document-column="${Number(location.columnNumber) || 0}" data-document-shelf="${Number(location.shelfNumber) || 0}">
    ${selectable ? `<td class="check-col" data-label="선택"><label class="bulk-check-target"><input type="checkbox" value="${id}" data-bulk-item aria-label="${escape(name)} 선택"${selected ? " checked" : ""}></label></td>` : ""}
    <td class="viewer-result-name"><a href="${escape(url)}" data-doc-click="${id}">${highlight(name, query, escape)}</a><span class="viewer-result-identity mono"><span class="viewer-result-number">${highlight(number, query, escape)}</span><small>${escape(revision)}</small></span>${disposed ? '<span class="status document-disposed">폐기</span>' : ""}</td>
    <td class="comparison-column result-number-column mono" data-label="문서번호">${highlight(number, query, escape)}</td>
    <td class="comparison-column result-revision-column mono" data-label="개정">${escape(revision)}</td>
    <td class="viewer-result-location" data-label="보관 위치">${escape(label)}</td>
    <td class="viewer-result-category" data-label="대분류">${escape(item.categoryName || "-")}</td>
    <td class="optional-column" data-column="revision-date" data-label="제·개정일" hidden>${escape(item.revisionDate || "-")}</td>
    <td class="viewer-result-action"><button type="button" class="button secondary sm" data-preview-open aria-label="${escape(name)} 빠른 보기">빠른 보기</button></td>
  </tr>`;
}

function resultTable(rows, selectable = false) {
  return `<div class="viewer-result-table${selectable ? " is-selectable" : ""}"><table aria-label="문서 검색 결과"><thead><tr class="viewer-result-header">${selectable ? '<th scope="col" class="check-col"><span class="sr-only">선택</span></th>' : ""}<th scope="col" class="result-name-heading"><span class="combined-heading">문서명 · 문서번호 · 개정</span><span class="comparison-heading">문서명</span></th><th scope="col" class="comparison-column result-number-column">문서번호</th><th scope="col" class="comparison-column result-revision-column">개정</th><th scope="col" class="result-location-heading">보관 위치</th><th scope="col" class="result-category-heading">대분류</th><th scope="col" data-column="revision-date" hidden>제·개정일</th><th scope="col"><span class="sr-only">빠른 보기</span></th></tr></thead><tbody class="viewer-result-list">${rows}</tbody></table></div>`;
}

window.HanlimResults = { resultRow, resultTable };
})();

    document.addEventListener('DOMContentLoaded', function () {
      var escapeHtmlClient = (function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
});
      var nav = document.querySelector('[data-nav-menu]');
      var scrim = document.querySelector('[data-nav-scrim]');
      var mobileMore = document.querySelector('[data-mobile-more]');
      var close = document.querySelector('[data-drawer-close]');
      var mediaQuery = function (query) {
        return typeof window.matchMedia === 'function'
          ? window.matchMedia(query)
          : { matches: false, addEventListener: function () {} };
      };
      var mobileNavigation = mediaQuery('(max-width: 1099px)');
      function navFocusable() {
        return nav ? Array.from(nav.querySelectorAll('a[href], button:not([disabled]), summary, input:not([disabled])')).filter(function (item) { return !item.hidden; }) : [];
      }
      function setNav(open, restoreFocus) {
        if (!nav) return;
        var mobile = mobileNavigation.matches;
        var visible = mobile && open;
        nav.classList.toggle('is-open', visible);
        if (scrim) scrim.classList.toggle('is-open', visible);
        if (mobileMore) mobileMore.setAttribute('aria-expanded', visible ? 'true' : 'false');
        if (mobile) {
          nav.inert = !visible;
          nav.setAttribute('aria-hidden', visible ? 'false' : 'true');
        } else {
          nav.inert = false;
          nav.removeAttribute('aria-hidden');
        }
        if (visible) setTimeout(function () { (close || navFocusable()[0])?.focus(); }, 0);
        if (!visible && restoreFocus && mobileMore) mobileMore.focus();
      }
      setNav(false, false);
      mobileNavigation.addEventListener?.('change', function () { setNav(false, false); });
      if (mobileMore) mobileMore.addEventListener('click', function () { setNav(true, false); });
      if (close) close.addEventListener('click', function () { setNav(false, true); });
      if (scrim) scrim.addEventListener('click', function () { setNav(false, true); });
      document.addEventListener('keydown', function (event) {
        if (!mobileNavigation.matches || !nav?.classList.contains('is-open')) return;
        if (event.key === 'Escape') { event.preventDefault(); setNav(false, true); return; }
        if (event.key !== 'Tab') return;
        var items = navFocusable();
        if (!items.length) return;
        var first = items[0];
        var last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      });

      if (typeof document.createElement === 'function' && document.body?.appendChild) {
        var confirmDialog = document.createElement('dialog');
        confirmDialog.className = 'app-confirm-dialog';
        confirmDialog.setAttribute('aria-labelledby', 'app-confirm-title');
        confirmDialog.innerHTML = '<form method="dialog" class="modal-body"><h2 id="app-confirm-title">작업 확인</h2><p data-confirm-message></p><div class="button-group"><button value="cancel" class="button secondary">취소</button><button value="confirm" class="danger-button" data-confirm-accept>계속</button></div></form>';
        document.body.appendChild(confirmDialog);
        var pendingForm = null;
        var pendingSubmitter = null;
        document.querySelectorAll('[data-confirm]').forEach(function (form) {
          form.addEventListener('submit', function (event) {
            if (form.dataset.confirmed === 'true') { delete form.dataset.confirmed; return; }
            event.preventDefault();
            pendingForm = form;
            pendingSubmitter = event.submitter || null;
            var message = confirmDialog.querySelector('[data-confirm-message]');
            if (message) message.textContent = form.dataset.confirm || '이 작업을 계속할까요?';
            if (typeof confirmDialog.showModal === 'function') confirmDialog.showModal();
          });
        });
        confirmDialog.addEventListener('close', function () {
          if (confirmDialog.returnValue === 'confirm' && pendingForm) {
            var form = pendingForm;
            var submitter = pendingSubmitter;
            pendingForm = null;
            pendingSubmitter = null;
            form.dataset.confirmed = 'true';
            form.requestSubmit(submitter || undefined);
            return;
          }
          pendingForm = null;
          pendingSubmitter = null;
        });
      }

      window.showAppMessage = function (message, isError) {
        if (typeof document.createElement !== 'function' || !document.body?.appendChild) return;
        document.querySelector('[data-global-message]')?.remove();
        var notice = document.createElement('div');
        notice.className = 'app-toast is-visible' + (isError ? ' is-error' : '');
        notice.setAttribute('role', isError ? 'alert' : 'status');
        notice.setAttribute('data-global-message', '');
        var text = document.createElement('span');
        text.textContent = String(message || '');
        var dismiss = document.createElement('button');
        dismiss.type = 'button';
        dismiss.className = 'icon-button';
        dismiss.setAttribute('aria-label', '알림 닫기');
        dismiss.textContent = '×';
        dismiss.addEventListener('click', function () { notice.remove(); });
        notice.append(text, dismiss);
        document.body.appendChild(notice);
      };

      document.querySelectorAll('[data-filter-toggle]').forEach(function (button) {
        var panel = document.getElementById(button.getAttribute('aria-controls') || '');
        if (!panel) return;
        function setFilterOpen(open) {
          panel.hidden = mediaQuery('(max-width: 760px)').matches ? !open : false;
          button.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
        }
        setFilterOpen(panel.dataset.active === 'true');
        button.addEventListener('click', function () { setFilterOpen(panel.hidden); });
      });

      document.querySelectorAll('[data-print]').forEach(function (button) {
        button.addEventListener('click', function () { window.print(); });
      });

      document.querySelectorAll('[data-auto-submit] select, [data-auto-submit] input[type="checkbox"]').forEach(function (control) {
        control.addEventListener('change', function () {
          if (control.form?.matches('[data-viewer-form]')) return;
          if (control.form) control.form.submit();
        });
      });

      document.querySelectorAll('[data-tab]').forEach(function (tab) {
        tab.addEventListener('click', function () {
          var id = tab.dataset.tab;
          var nav = tab.closest('.tab-nav');
          if (nav) nav.querySelectorAll('[role="tab"]').forEach(function (item) { item.setAttribute('aria-selected', 'false'); });
          tab.setAttribute('aria-selected', 'true');
          document.querySelectorAll('.tab-panel').forEach(function (panel) { panel.hidden = panel.id !== 'panel-' + id; });
        });
      });

      document.querySelectorAll('[data-auto-open-modal]').forEach(function (modal) {
        if (modal.hasAttribute('data-forced-modal')) {
          modal.addEventListener('cancel', function (event) { event.preventDefault(); });
        }
        if (typeof modal.showModal === 'function') {
          // open 속성은 스크립트 실패 시에도 폼이 보이게 하는 fallback이다. 정상 브라우저에서는 top layer modal로 승격한다.
          if (modal.open) modal.close();
          modal.showModal();
        }
      });
      document.querySelectorAll('[data-open-modal]').forEach(function (button) {
        button.addEventListener('click', function () {
          var modal = document.getElementById(button.dataset.openModal);
          if (modal && modal.showModal) modal.showModal();
        });
      });
      document.querySelectorAll('[data-close-modal]').forEach(function (button) {
        button.addEventListener('click', function () {
          var modal = button.closest('dialog');
          if (modal) modal.close();
        });
      });

      // 즉시검색은 결과 버튼을 innerHTML로 나중에 만든다. 문서에 한 번만 위임해 서버 렌더,
      // 문서 상세, 동적 결과가 모두 같은 복사 동작을 쓰게 한다.
      document.addEventListener('click', function (event) {
        var button = event.target && event.target.closest ? event.target.closest('[data-copy-text]') : null;
        if (!button) return;
        var text = button.dataset.copyText || '';
        if (!text) return;
        var originalHtml = button.innerHTML;
        function done() {
          button.textContent = '복사됨';
          setTimeout(function () { button.innerHTML = originalHtml; }, 1400);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done).catch(function () {});
        } else {
          var input = document.createElement('textarea');
          input.value = text;
          input.setAttribute('readonly', '');
          input.className = 'clipboard-proxy';
          document.body.appendChild(input);
          input.select();
          try { document.execCommand('copy'); done(); } catch {}
          input.remove();
        }
      });

      document.querySelectorAll('[data-suggest-input]').forEach(function (input) {
        var datalist = input.parentElement ? input.parentElement.querySelector('[data-suggest-list]') : null;
        var timer = null;
        input.addEventListener('input', function () {
          clearTimeout(timer);
          var q = input.value.trim();
          if (!datalist || q.length < 2) return;
          if (input.closest('[data-viewer-form]')) {
            datalist.innerHTML = '';
            return;
          }
          timer = setTimeout(function () {
            var suggestionUrl = '/api/search-suggestions?q=' + encodeURIComponent(q);
            fetch(suggestionUrl, { headers: { Accept: 'application/json' } })
              .then(function (response) { return response.ok ? response.json() : { suggestions: [] }; })
              .then(function (data) {
                datalist.innerHTML = (data.suggestions || []).map(function (item) {
                  return '<option value="' + escapeHtmlClient(item.value) + '">' + escapeHtmlClient(item.label || item.value) + '</option>';
                }).join('');
              })
              .catch(function () {});
          }, 180);
        });
      });

      var bulkBar = document.querySelector('[data-bulk-bar]');
      var bulkIds = Array.from(document.querySelectorAll('[data-bulk-ids]'));
      var bulkCount = document.querySelector('[data-bulk-count]');
      var bulkSummary = document.querySelector('[data-bulk-summary]');
      var bulkSelectAll = document.querySelector('[data-bulk-select-all]');
      var bulkConfirmCount = document.querySelector('[data-bulk-confirm-count]');
      var bulkConfirmCountInput = document.querySelector('[data-bulk-confirm-count-input]');
      var bulkConfirmButton = document.querySelector('[data-bulk-confirm-button]');
      var bulkDisposalButton = document.querySelector('[data-disposal-limit]');
      var bulkLimitNotice = document.querySelector('[data-bulk-limit-notice]');
      function syncBulk() {
        var items = Array.from(document.querySelectorAll('[data-bulk-item]'));
        var checkedItems = items.filter(function (item) { return item.checked; });
        var checked = checkedItems.map(function (item) { return item.value; });
        var disposalLimit = bulkDisposalButton ? Number(bulkDisposalButton.dataset.disposalLimit || 0) : 0;
        var overLimit = Boolean(disposalLimit && checked.length > disposalLimit);
        if (bulkBar) bulkBar.hidden = checked.length === 0;
        bulkIds.forEach(function (input) { input.value = checked.join(','); });
        if (bulkCount) bulkCount.textContent = bulkBar && bulkBar.hasAttribute('data-document-selection')
          ? checked.length + '건 선택'
          : '원본 ' + checked.length + '부 선택';
        if (bulkLimitNotice) {
          bulkLimitNotice.textContent = overLimit
            ? '한 번에 ' + disposalLimit + '건까지 폐기할 수 있습니다. ' + (checked.length - disposalLimit) + '건을 해제하세요.'
            : '';
          bulkLimitNotice.hidden = !overLimit;
        }
        if (bulkConfirmCount) bulkConfirmCount.textContent = checked.length + '부';
        if (bulkConfirmCountInput) bulkConfirmCountInput.value = String(checked.length);
        if (bulkConfirmButton) {
          bulkConfirmButton.disabled = checked.length === 0 || overLimit;
          bulkConfirmButton.textContent = checked.length
            ? '예, 원본 ' + checked.length + '부를 폐기합니다'
            : '예, 폐기합니다';
        }
        if (bulkSummary) {
          bulkSummary.innerHTML = '';
          checkedItems.forEach(function (item) {
            var row = item.closest('[data-document-row]');
            var name = row ? row.querySelector('.viewer-result-name a, .name-cell a') : null;
            var number = row ? row.querySelector('.mono-cell, .mono') : null;
            var revision = row ? row.querySelector('.revision-cell') : null;
            var entry = document.createElement('li');
            entry.textContent = (number ? number.textContent.trim() : '선택 문서') +
              (revision ? ' / ' + revision.textContent.trim() : '') +
              (name ? ' · ' + name.textContent.trim() : '');
            bulkSummary.appendChild(entry);
          });
        }
        if (bulkSelectAll) {
          bulkSelectAll.checked = items.length > 0 && checked.length === items.length;
          bulkSelectAll.indeterminate = checked.length > 0 && checked.length < items.length;
          bulkSelectAll.disabled = items.length === 0;
        }
        if (bulkDisposalButton) {
          bulkDisposalButton.disabled = overLimit;
          bulkDisposalButton.title = overLimit
            ? '폐기는 한 번에 ' + disposalLimit + '건 이하만 선택하세요.'
            : '';
        }
      }
      document.addEventListener('change', function (event) {
        if (event.target && event.target.matches && event.target.matches('[data-bulk-item]')) syncBulk();
      });
      if (bulkSelectAll) {
        bulkSelectAll.addEventListener('change', function () {
          document.querySelectorAll('[data-bulk-item]').forEach(function (item) { item.checked = bulkSelectAll.checked; });
          syncBulk();
        });
      }
      syncBulk();

      var setSelectionForm = document.querySelector('[data-set-selection-form]');
      var setTarget = document.querySelector('[data-set-target]');
      var setVersion = document.querySelector('[data-set-version]');
      if (setSelectionForm && setTarget) {
        var syncSetTarget = function () {
          var option = setTarget.options[setTarget.selectedIndex];
          var setId = Number(option ? option.value : 0);
          setSelectionForm.action = setId ? '/sets/' + setId + '/add' : '/sets/0/add';
          if (setVersion) setVersion.value = option ? option.dataset.version || '' : '';
        };
        setTarget.addEventListener('change', syncSetTarget);
        syncSetTarget();
      }

      var commandPalette = document.querySelector('[data-command-palette]');
      var commandInput = document.querySelector('[data-command-input]');
      var commandItems = Array.prototype.slice.call(document.querySelectorAll('[data-command-item]'));
      var commandActiveIndex = -1;
      var commandPreviousFocus = null;
      var visibleCommands = function () {
        return commandItems.filter(function (item) { return !item.hidden; });
      };
      var setActiveCommand = function (index) {
        var visible = visibleCommands();
        commandItems.forEach(function (item) {
          item.classList.remove('is-active');
          item.removeAttribute('aria-current');
        });
        if (!visible.length) {
          commandActiveIndex = -1;
          return;
        }
        commandActiveIndex = Math.max(0, Math.min(index, visible.length - 1));
        visible[commandActiveIndex].classList.add('is-active');
        visible[commandActiveIndex].setAttribute('aria-current', 'true');
        visible[commandActiveIndex].scrollIntoView({ block: 'nearest' });
      };
      var filterCommands = function () {
        var query = (commandInput ? commandInput.value : '').trim().toLocaleLowerCase('ko-KR');
        commandItems.forEach(function (item) {
          var label = (item.getAttribute('data-command-label') || item.textContent || '').toLocaleLowerCase('ko-KR');
          item.hidden = Boolean(query && label.indexOf(query) === -1);
        });
        setActiveCommand(0);
      };
      var openCommands = function () {
        if (!commandPalette || typeof commandPalette.showModal !== 'function') return;
        commandPreviousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        if (!commandPalette.open) commandPalette.showModal();
        if (commandInput) {
          commandInput.value = '';
          filterCommands();
          setTimeout(function () { commandInput.focus(); }, 0);
        }
      };
      document.querySelectorAll('[data-command-open]').forEach(function (button) {
        button.addEventListener('click', openCommands);
      });
      document.querySelectorAll('[data-command-close]').forEach(function (button) {
        button.addEventListener('click', function () { if (commandPalette && commandPalette.open) commandPalette.close(); });
      });
      if (commandPalette) {
        commandPalette.addEventListener('close', function () {
          commandActiveIndex = -1;
          commandItems.forEach(function (item) {
            item.classList.remove('is-active');
            item.removeAttribute('aria-current');
          });
          if (commandPreviousFocus && document.contains(commandPreviousFocus)) commandPreviousFocus.focus();
          commandPreviousFocus = null;
        });
      }
      if (commandInput) {
        commandInput.addEventListener('input', filterCommands);
        commandInput.addEventListener('keydown', function (event) {
          var visible = visibleCommands();
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveCommand(commandActiveIndex + 1);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveCommand(commandActiveIndex <= 0 ? visible.length - 1 : commandActiveIndex - 1);
          } else if (event.key === 'Home') {
            event.preventDefault();
            setActiveCommand(0);
          } else if (event.key === 'End') {
            event.preventDefault();
            setActiveCommand(visible.length - 1);
          } else if (event.key === 'Enter' && visible.length) {
            event.preventDefault();
            visible[Math.max(0, commandActiveIndex)].click();
          } else if (event.key === 'Escape' && commandPalette && commandPalette.open) {
            event.preventDefault();
            commandPalette.close();
          }
        });
      }
      document.addEventListener('keydown', function (event) {
        if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase('en-US') === 'k') {
          event.preventDefault();
          openCommands();
        }
      });

      var bulkForm = document.querySelector('[data-bulk-form]');
      if (bulkForm) {
        bulkForm.addEventListener('submit', function (event) {
          var count = document.querySelectorAll('[data-bulk-item]:checked').length;
          var confirmedCount = Number(bulkConfirmCountInput ? bulkConfirmCountInput.value : 0);
          if (!count || confirmedCount !== count) event.preventDefault();
        });
      }

      var documentDetail = document.querySelector('[data-document-detail]');
      if (documentDetail) {
        function centerInside(scroller, target) {
          if (!scroller || !target) return;
          var scrollRect = scroller.getBoundingClientRect();
          var targetRect = target.getBoundingClientRect();
          var left = scroller.scrollLeft + targetRect.left - scrollRect.left - (scrollRect.width - targetRect.width) / 2;
          scroller.scrollLeft = Math.max(0, left);
        }

        function centerLocationTargets(scope) {
          (scope || documentDetail).querySelectorAll('[data-rack-scroll]').forEach(function (scroller) {
            centerInside(scroller, scroller.querySelector('.mini-slot.active'));
          });
          (scope || documentDetail).querySelectorAll('[data-document-floor-scroll]').forEach(function (scroller) {
            centerInside(scroller, scroller.querySelector('.floor-rack.is-hit, .floor-rack[data-face-hit]'));
          });
        }

        requestAnimationFrame(function () { centerLocationTargets(documentDetail); });
        var locationResizeTimer = 0;
        window.addEventListener('resize', function () {
          clearTimeout(locationResizeTimer);
          locationResizeTimer = setTimeout(function () { centerLocationTargets(documentDetail); }, 80);
        });

        documentDetail.querySelectorAll('[data-document-floor-zoom]').forEach(function (button) {
          var scroller = document.getElementById(button.getAttribute('aria-controls') || '');
          if (!scroller) return;
          button.addEventListener('click', function () {
            var expanded = scroller.classList.toggle('is-zoomed');
            button.setAttribute('aria-pressed', expanded ? 'true' : 'false');
            button.textContent = expanded ? '전체 보기' : '도면 크게 보기';
            if (expanded) centerInside(scroller, scroller.querySelector('.floor-rack.is-hit, .floor-rack[data-face-hit]'));
            else scroller.scrollLeft = 0;
          });
        });

        var actionQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(max-width: 760px)') : null;
        function syncDetailActions() {
          documentDetail.querySelectorAll('[data-detail-actions]').forEach(function (details) {
            if (actionQuery?.matches) {
              if (!details.dataset.mobileInitialized) details.open = false;
              details.dataset.mobileInitialized = 'true';
            } else {
              details.open = true;
              delete details.dataset.mobileInitialized;
            }
          });
        }
        syncDetailActions();
        actionQuery?.addEventListener?.('change', syncDetailActions);
      }

      var currentPath = location.pathname;
      var currentUrl = new URL(location.href);
      var parentNavigation = /^\/documents\/\d+(?:\/|$)/.test(currentPath) ? '/app'
        : currentPath.startsWith('/document-snapshots/') ? '/documents/import'
        : currentPath.startsWith('/disposal-batches') ? '/documents/disposal' : '';
      var activeNavItems = Array.from(document.querySelectorAll('.archive-nav-item, .nav-sub-link, [data-command-item]')).filter(function (item) {
        var href = item.getAttribute('href') || '';
        if (!href) return false;
        var itemUrl = new URL(href, location.origin);
        var pathMatches = itemUrl.pathname === currentPath || (itemUrl.pathname.length > 1 && currentPath.indexOf(itemUrl.pathname + '/') === 0);
        var queryMatches = Array.from(itemUrl.searchParams.entries()).every(function (entry) {
          return currentUrl.searchParams.getAll(entry[0]).includes(entry[1]);
        });
        return (pathMatches && queryMatches) || Boolean(parentNavigation && href === parentNavigation);
      }).sort(function (left, right) {
        return (right.getAttribute('href') || '').length - (left.getAttribute('href') || '').length;
      });
      var activeHref = activeNavItems[0] ? activeNavItems[0].getAttribute('href') : '';
      activeNavItems.forEach(function (item) {
        if (item.getAttribute('href') === activeHref) { item.classList.add('active'); item.setAttribute('aria-current', 'page'); }
      });

      // 검색·위치는 항상 보이고, 접힌 업무 그룹은 현재 화면과 사용자가 열어 둔 상태를 반영한다.
      var storedNavigationGroups = [];
      try {
        storedNavigationGroups = JSON.parse(localStorage.getItem('hanlimNavigationGroups') || '[]');
        if (!Array.isArray(storedNavigationGroups)) storedNavigationGroups = [];
      } catch { storedNavigationGroups = []; }
      var navigationGroups = Array.from(document.querySelectorAll('[data-nav-group]'));
      navigationGroups.forEach(function (group) {
        var key = group.getAttribute('data-nav-group') || '';
        var hasActiveItem = Boolean(group.querySelector('.archive-nav-item.active, .nav-sub-link.active'));
        group.classList.toggle('has-active', hasActiveItem);
        group.open = hasActiveItem || storedNavigationGroups.includes(key);
        group.addEventListener('toggle', function () {
          var opened = navigationGroups.filter(function (item) { return item.open; }).map(function (item) { return item.getAttribute('data-nav-group') || ''; }).filter(Boolean);
          try { localStorage.setItem('hanlimNavigationGroups', JSON.stringify(opened)); } catch {}
        });
      });

      var toastKey = new URLSearchParams(location.search).get('toast');
      if (toastKey) {
        var toastParams = new URLSearchParams(location.search);
        var toastMessages = {"created":"문서가 등록되었습니다.","document-created":"문서가 등록되어 세트에 추가되었습니다.","updated":"문서 정보가 수정되었습니다.","revised":"새 개정 문서가 등록되었습니다.","moved":"문서 위치가 이동되었습니다.","disposed":"폐기 처리되었습니다.","restored":"폐기가 해제되었습니다.","deleted":"문서가 완전 삭제되었습니다.","saved":"저장되었습니다.","bulk-disposed":"선택한 문서를 폐기 처리했습니다.","approved":"가입 요청을 승인했습니다.","rejected":"가입 요청을 거절했습니다.","enabled":"사용자 계정을 활성화했습니다.","disabled":"사용자 계정을 비활성화했습니다.","permissions-saved":"사용자 권한을 저장했습니다.","template-saved":"역할 템플릿을 저장했습니다.","template-applied":"선택한 사용자에게 역할 템플릿을 반영했습니다.","password-reset":"임시 비밀번호를 설정했습니다. 다음 로그인에서 비밀번호 변경이 강제됩니다.","password-changed":"비밀번호가 변경되었습니다.","user-deleted":"계정을 완전삭제했습니다.","user-created":"승인 사용자를 추가했습니다. 임시 비밀번호를 안전하게 전달하세요.","set-locked":"준비 문서 세트를 잠갔습니다.","set-unlocked":"준비 문서 세트의 잠금을 해제했습니다.","error":"요청을 처리하지 못했습니다. 입력값을 확인하세요."};
        var toastMessage = toastMessages[toastKey];
        if (toastKey === 'bulk-disposed') {
          var disposedCount = Number(toastParams.get('disposed') || 0);
          var skippedCount = Number(toastParams.get('skipped') || 0);
          toastMessage = '폐기 ' + disposedCount + '건 완료' + (skippedCount ? ' · 건너뜀 ' + skippedCount + '건' : '') + '.';
        }
        if (toastMessage) {
          window.showAppMessage?.(toastMessage, toastKey === 'error');
        }
        try {
          var cleanUrl = new URL(location.href);
          cleanUrl.searchParams.delete('toast');
          cleanUrl.searchParams.delete('disposed');
          cleanUrl.searchParams.delete('skipped');
          history.replaceState(null, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
        } catch {}
      }

      // 검색 결과 클릭 학습 (아이디어 8): 클릭된 문서를 검색어와 함께 집계한다.
      document.addEventListener('click', function (event) {
        if (document.body?.dataset.accessMode === 'demo_readonly') return;
        var target = event.target instanceof Element ? event.target : null;
        var link = target && target.closest ? target.closest('[data-doc-click]') : null;
        if (!link) return;
        var input = document.querySelector('[data-search-form] input[name="q"]');
        var q = input ? input.value.trim() : '';
        var csrfMeta = document.querySelector('meta[name="csrf-token"]');
        if (!q || !csrfMeta || !navigator.sendBeacon) return;
        var payload = new FormData();
        payload.append('q', q);
        payload.append('documentId', link.getAttribute('data-doc-click'));
        payload.append('csrf_token', csrfMeta.getAttribute('content') || '');
        navigator.sendBeacon('/api/search-click', payload);
      });

      document.querySelectorAll('[data-master-management]').forEach(function (root) {
        var search = root.querySelector('[data-master-search]');
        var inactiveToggle = root.querySelector('[data-master-inactive-toggle]');
        var rows = Array.from(root.querySelectorAll('[data-master-row]'));
        var empty = root.querySelector('[data-master-filter-empty]');
        if (!search || !inactiveToggle || !rows.length) return;

        var normalizeMasterText = function (value) {
          return String(value || '').trim().toLocaleLowerCase('ko-KR');
        };
        var applyMasterFilters = function () {
          var query = normalizeMasterText(search.value);
          var showInactive = inactiveToggle.checked;
          var visible = 0;
          rows.forEach(function (row) {
            var matchesState = row.dataset.masterActive === 'true' || showInactive;
            var matchesText = !query || normalizeMasterText(row.dataset.masterSearchText).includes(query);
            var matches = matchesState && matchesText;
            row.hidden = !matches;
            if (!matches && row.open) row.open = false;
            if (matches) visible += 1;
          });
          if (empty) empty.hidden = visible > 0;
        };

        search.addEventListener('input', applyMasterFilters);
        inactiveToggle.addEventListener('change', applyMasterFilters);
        applyMasterFilters();
      });
      var normalizeSearchStateUrl = function (value) {
        var url = new URL(value, 'https://archive.local');
        var params = new URLSearchParams();
        ['q','category','tag','zone','rack','face','column','shelf','sort'].forEach(function (key) {
          var value = url.searchParams.get(key);
          if (key === 'sort' && !value) value = viewerForm?.elements?.namedItem('sort')?.value || '';
          if (value && !(key === 'sort' && value === 'relevance')) params.set(key, value);
        });
        return '/app' + (params.size ? '?' + params.toString() : '');
      };
      // 서버 즉시 검색: Core projection 후보 → Core 재검증 → 최대 30건 cursor 응답.
      var viewerApp = document.querySelector('[data-viewer-app]');
      var viewerForm = document.querySelector('[data-viewer-form]');
      var viewerInput = viewerForm ? viewerForm.querySelector('input[name="q"]') : null;
      if (viewerApp && viewerInput && window.SearchCore) {
        var resultsBody = document.querySelector('[data-results-body]');
        var resultsTitle = document.querySelector('[data-results-title]');
        var resultsCount = document.querySelector('[data-results-count]');
        var searchLive = document.querySelector('[data-search-live]');
        var activeFilterChips = document.querySelector('[data-active-filter-chips]');
        var parsedFilterChips = document.querySelector('[data-parsed-filter-chips]');
        var mobileFilterForm = document.querySelector('[data-mobile-viewer-filter]');
        var mobileFilterDialog = mobileFilterForm?.closest('dialog') || null;
        var viewerContextElement = document.querySelector('[data-viewer-context]');
        var viewerContext = { categories: [], tags: [], racks: [], explicitFilters: {} };
        try { viewerContext = JSON.parse(viewerContextElement?.textContent || '{}'); } catch {}
        var workspaceSelectable = Boolean(document.querySelector('[data-document-selection]'));
        var renderTimer = null;
        var activeRequest = null;
        var searchSequence = 0;
        var composing = false;
        var retryCursor = '';
        var restoreState = null;
        var returnStateKey = 'hanlimSearchReturn:' + (document.body?.dataset.navigationScope || '');
        try {
          var savedSearch = JSON.parse(sessionStorage.getItem(returnStateKey) || 'null');
          if (savedSearch && normalizeSearchStateUrl(savedSearch.url) === normalizeSearchStateUrl(location.pathname + location.search) && Date.now() - savedSearch.time < 1800000) restoreState = savedSearch;
          sessionStorage.removeItem(returnStateKey);
        } catch {}
        var resetSearchSelection = function () {
          document.dispatchEvent(new Event('hanlim:search-change'));
          document.querySelectorAll('[data-bulk-item]:checked').forEach(function (item) { item.checked = false; });
          syncBulk();
        };
        var invalidateSearch = function () {
          searchSequence += 1;
          if (activeRequest) activeRequest.abort();
          restoreState = null;
          resetSearchSelection();
        };
        var currentCursor = '';
        var currentItems = [];
        var filterNames = ['category','tag','zone','status','sort','rack','face','column','shelf'];

        var replaceResults = function (html, preserveSelection) {
          var selectedIds = preserveSelection
            ? new Set(Array.from(document.querySelectorAll('[data-bulk-item]:checked')).map(function (item) { return item.value; }))
            : new Set();
          if (resultsBody) {
            resultsBody.innerHTML = html;
            if (selectedIds.size) {
              resultsBody.querySelectorAll('[data-bulk-item]').forEach(function (item) {
                item.checked = selectedIds.has(item.value);
              });
            }
          }
          syncBulk();
        };

        var formControl = function (form, name) {
          if (!form) return null;
          var control = form.elements?.namedItem?.(name);
          return control || form.querySelector?.('[name="' + name + '"]') || null;
        };

        var formValue = function (name) {
          var control = formControl(viewerForm, name);
          return control && typeof control.value === 'string' ? control.value : '';
        };

        var setFormValue = function (form, name, value) {
          var control = formControl(form, name);
          if (control && typeof control.value === 'string') control.value = value;
        };

        var explicitFilterContext = function () {
          return {
            categoryId: Number(formValue('category') || 0),
            tagId: Number(formValue('tag') || 0),
            zoneNumber: Number(formValue('zone') || 0),
            rackId: Number(formValue('rack') || 0),
            rackFace: formValue('face'),
            columnNumber: Number(formValue('column') || 0),
            shelfNumber: Number(formValue('shelf') || 0),
            status: formValue('status') || 'active'
          };
        };

        var parsedSearch = function () {
          return window.SearchCore.parseSearchQuery(viewerInput.value.trim(), {
            categories: viewerContext.categories || [],
            tags: viewerContext.tags || [],
            explicit: explicitFilterContext()
          });
        };

        var searchParams = function (cursor) {
          var params = new URLSearchParams({ q: viewerInput.value.trim(), limit: '30' });
          ['category','tag','zone','status','sort','rack','face','column','shelf'].forEach(function (name) {
            var value = formValue(name);
            if (value) params.set(name, value);
          });
          if (cursor) params.set('cursor', cursor);
          return params;
        };

        var searchRequestParams = function (cursor) {
          var params = searchParams(cursor);
          var parsed = parsedSearch();
          params.set('q', parsed.text || '');
          params.set('resolved', '1');
          if (!formValue('category') && parsed.filters?.categoryId) params.set('category', String(parsed.filters.categoryId));
          if (!formValue('tag') && parsed.filters?.tagId) params.set('tag', String(parsed.filters.tagId));
          if (!formValue('zone') && parsed.filters?.zoneNumber) params.set('zone', String(parsed.filters.zoneNumber));
          return params;
        };

        var canonicalParams = function () {
          var params = searchParams('');
          params.delete('limit');
          if (!viewerInput.value.trim()) params.delete('q');
          return params;
        };

        var syncBrowserUrl = function () {
          try {
            var params = canonicalParams();
            var query = params.toString();
            history.replaceState(null, '', '/app' + (query ? '?' + query : ''));
          } catch {}
        };

        var filterHref = function (name) {
          var params = canonicalParams();
          if (name === 'status') params.set('status', 'active');
          else params.delete(name);
          if (name === 'rack') ['face','column','shelf'].forEach(function (part) { params.delete(part); });
          var query = params.toString();
          return '/app' + (query ? '?' + query : '');
        };

        var labelForFilter = function (collection, value, fallback) {
          var match = Array.isArray(collection) ? collection.find(function (item) { return String(item.id) === String(value); }) : null;
          return match?.name || fallback;
        };

        var rackLabel = function (value) {
          var rack = Array.isArray(viewerContext.racks) ? viewerContext.racks.find(function (item) { return String(item.id) === String(value); }) : null;
          return rack?.code ? '랙 ' + rack.code : '랙 ' + value;
        };

        var faceLabel = function (value) {
          var rack = Array.isArray(viewerContext.racks) ? viewerContext.racks.find(function (item) { return String(item.id) === String(formValue('rack')); }) : null;
          return rack?.isSingleSided ? '단면' : value === 'B' ? '2면' : '1면';
        };

        var removeQueryToken = function (token) {
          var removed = false;
          viewerInput.value = viewerInput.value.trim().split(/\s+/).filter(function (part) {
            if (!removed && part === token) { removed = true; return false; }
            return true;
          }).join(' ');
        };

        var renderParsedFilterChips = function () {
          if (!parsedFilterChips) return;
          var parsed = parsedSearch();
          if (!parsed.chips?.length) { parsedFilterChips.innerHTML = ''; return; }
          var labels = { zone: '구역', category: '대분류', tag: '태그', status: '상태' };
          parsedFilterChips.innerHTML = '<div class="parsed-chip-row" aria-label="검색어에서 인식한 조건"><span>자동 적용</span>' + parsed.chips.map(function (chip) {
            var token = String(chip.token || chip.label || '');
            return '<a class="chip active" href="#" data-viewer-remove-token="' + escapeHtmlClient(token) + '" title="조건 해제">' + escapeHtmlClient(labels[chip.type] || chip.type) + ': ' + escapeHtmlClient(chip.label) + ' ×</a>';
          }).join('') + '</div>';
        };

        var renderActiveFilterChips = function () {
          if (!activeFilterChips) return;
          var chips = [];
          var add = function (name, label) {
            chips.push('<a class="chip active" href="' + escapeHtmlClient(filterHref(name)) + '" data-viewer-clear-filter="' + name + '">' + escapeHtmlClient(label) + ' <span aria-hidden="true">×</span></a>');
          };
          if (formValue('category')) add('category', labelForFilter(viewerContext.categories, formValue('category'), '대분류'));
          if (formValue('tag')) add('tag', labelForFilter(viewerContext.tags, formValue('tag'), '태그'));
          if (formValue('zone')) add('zone', formValue('zone') + '구역');
          if (formValue('rack')) add('rack', rackLabel(formValue('rack')));
          if (formValue('face')) add('face', faceLabel(formValue('face')));
          if (formValue('column')) add('column', formValue('column') + '열');
          if (formValue('shelf')) add('shelf', formValue('shelf') + '선반');
          if (formValue('status') && formValue('status') !== 'active') add('status', formValue('status') === 'disposed' ? '폐기' : '전체 상태');
          activeFilterChips.innerHTML = chips.length ? '<nav class="active-filter-chips" aria-label="적용된 필터">' + chips.join('') + '</nav>' : '';
        };

        var syncMobileFilters = function () {
          if (!mobileFilterForm) return;
          setFormValue(mobileFilterForm, 'q', viewerInput.value.trim());
          filterNames.forEach(function (name) { setFormValue(mobileFilterForm, name, formValue(name)); });
        };

        var syncFilterUi = function () {
          var count = ['category','tag','zone','rack','face','column','shelf'].filter(function (name) { return Boolean(formValue(name)); }).length;
          if (formValue('status') && formValue('status') !== 'active') count += 1;
          document.querySelectorAll('[data-viewer-filter-count]').forEach(function (badge) {
            badge.textContent = String(count);
            badge.hidden = count === 0;
          });
          renderActiveFilterChips();
          renderParsedFilterChips();
          syncMobileFilters();
        };

        var syncWorkspaceReturnTo = function () {
          var params = canonicalParams();
          var query = params.toString();
          var returnTo = '/app' + (query ? '?' + query : '');
          document.querySelectorAll('[data-workspace-return-to]').forEach(function (input) {
            input.value = returnTo;
          });
        };

        var resultRow = function (item, query) {
          return window.HanlimResults.resultRow(item, { selectable: workspaceSelectable, query: query, returnTo: '/app' + (canonicalParams().size ? '?' + canonicalParams().toString() : '') }, escapeHtmlClient, window.SearchCore.highlightHtml);
        };

        var renderPayload = function (payload, append) {
          var query = parsedSearch().text;
          var incomingItems = payload.items || [];
          currentItems = append ? currentItems.concat(incomingItems) : incomingItems;
          currentCursor = payload.nextCursor || '';
          var listHtml = incomingItems.map(function (item) { return resultRow(item, query); }).join('');
          var html = window.HanlimResults.resultTable(listHtml, workspaceSelectable);
          if (!currentItems.length) {
            html = '<div class="empty-state"><i class="fa-regular fa-folder-open"></i><p>조건에 맞는 문서가 없습니다.</p><div class="empty-actions"><a class="button secondary sm" href="/app" data-viewer-search-reset>검색 초기화</a>' + (viewerApp.dataset.canSearchDisposed === 'true' ? '<a class="button secondary sm" href="/documents/disposal?tab=documents">폐기 문서에서 확인</a>' : '') + '</div></div>';
          }
          // fallback 경로는 최근 수정순 후보 창 안에서만 점수를 매기므로 결과 수와 무관하게
          // 오래된 문서가 빠질 수 있다. 누락 가능성은 항상 알리고 문구만 상태에 맞게 나눈다.
          if (payload.fallback) {
            html = '<div class="alert warning" role="status">검색 색인을 재구성하는 중입니다. '
              + (currentItems.length ? '오래된 문서가 결과에서 빠질 수 있으니' : '결과가 제한될 수 있으니')
              + ' 찾는 문서가 없으면 잠시 후 다시 검색하세요.</div>' + html;
          }
          if (append && resultsBody) {
            var list = resultsBody.querySelector('.viewer-result-list');
            if (list) {
              if (incomingItems.length) list.insertAdjacentHTML('beforeend', listHtml);
              resultsBody.querySelector('[data-search-more]')?.closest('nav')?.remove();
              syncBulk();
            } else {
              html = html.replace(listHtml, currentItems.map(function (item) { return resultRow(item, query); }).join(''));
              replaceResults(html, true);
            }
          } else {
            replaceResults(html, false);
          }
          if (currentItems.length && payload.hasMore && currentCursor && resultsBody) {
            resultsBody.insertAdjacentHTML('beforeend', '<nav class="pagination"><button type="button" class="button secondary sm" data-search-more>더보기</button></nav>');
          }
          if (resultsTitle) resultsTitle.textContent = '보관중 문서';
          var hasKnownTotal = payload.candidateCount !== null && payload.candidateCount !== undefined;
          var totalFound = hasKnownTotal ? Number(payload.candidateCount) : currentItems.length;
          if (resultsCount) resultsCount.textContent = currentItems.length.toLocaleString('ko-KR') + '건 표시' + (payload.hasMore ? ' · 더 있음' : '');
          if (searchLive) {
            searchLive.textContent = !currentItems.length
              ? '검색 결과가 없습니다.'
              : !hasKnownTotal && payload.hasMore
                ? currentItems.length.toLocaleString('ko-KR') + '건을 표시했습니다. 더보기로 이어서 확인하세요.'
                : currentItems.length < totalFound
                ? totalFound.toLocaleString('ko-KR') + '건 중 ' + currentItems.length.toLocaleString('ko-KR') + '건을 표시했습니다. 더보기로 이어서 확인하세요.'
                : totalFound.toLocaleString('ko-KR') + '건을 모두 표시했습니다.';
          }
          viewerApp.hidden = false;
          var revisionToggle = document.querySelector('[data-column-toggle="revision-date"]');
          document.querySelectorAll('[data-column="revision-date"]').forEach(function (cell) {
            cell.hidden = !revisionToggle?.checked;
          });
          document.querySelectorAll('.viewer-result-table').forEach(function (table) {
            table.classList.toggle('show-revision-date', Boolean(revisionToggle?.checked));
          });
        };

        var renderError = function (message) {
          var params = searchParams('');
          var html = '<div class="alert danger" role="alert">' + escapeHtmlClient(message || '검색을 처리하지 못했습니다.') + '</div><div class="empty-actions"><button type="button" class="button secondary sm" data-search-retry>다시 시도</button><a class="button secondary sm" href="/app?' + escapeHtmlClient(params.toString()) + '">검색 화면에서 계속</a></div>';
          replaceResults(html, false);
          if (resultsTitle) resultsTitle.textContent = '검색을 계속할 수 없습니다';
          if (resultsCount) resultsCount.textContent = '-';
          if (searchLive) searchLive.textContent = '검색 요청을 처리하지 못했습니다.';
          viewerApp.hidden = false;
        };

        var requestSearch = async function (cursor, append, staleRetry) {
          clearTimeout(renderTimer);
          if (composing) return;
          if (activeRequest) activeRequest.abort();
          var sequence = ++searchSequence;
          if (!append) resetSearchSelection();
          activeRequest = typeof AbortController === 'function' ? new AbortController() : null;
          retryCursor = append ? cursor : '';
          viewerApp.setAttribute('aria-busy', 'true');
          if (searchLive) searchLive.textContent = append ? '다음 결과를 불러오는 중…' : '검색 중…';
          try {
            var response = await fetch('/api/viewer/search?' + searchRequestParams(cursor).toString(), {
              headers: { Accept: 'application/json' },
              ...(activeRequest ? { signal: activeRequest.signal } : {})
            });
            var payload = await response.json().catch(function () { return {}; });
            if (sequence !== searchSequence) return;
            if (response.status === 409 && payload.code === 'SEARCH_CURSOR_STALE' && !staleRetry) return requestSearch('', false, true);
            if (!response.ok || payload.ok === false || !Array.isArray(payload.items)) throw new Error(payload.message || '검색 요청에 실패했습니다.');
            window.__hanlimSearchIndexReady = true;
            var datalist = viewerInput.parentElement?.querySelector?.('[data-suggest-list]');
            if (datalist && Array.isArray(payload.suggestions)) datalist.innerHTML = payload.suggestions.map(function (item) {
              return '<option value="' + escapeHtmlClient(item.value) + '">' + escapeHtmlClient(item.label || item.value) + '</option>';
            }).join('');
            renderPayload(payload, append);
            if (restoreState) {
              var anchor = document.querySelector('[data-document-id="' + Number(restoreState.id) + '"]');
              if (payload.hasMore && currentCursor && currentItems.length < restoreState.count && payload.items.length) return requestSearch(currentCursor, true);
              var previousState = restoreState;
              restoreState = null;
              requestAnimationFrame(function () {
                if (sequence !== searchSequence) return;
                if (anchor) { anchor.scrollIntoView({ block: 'center' }); anchor.querySelector('a')?.focus({ preventScroll: true }); }
                else { window.scrollTo(0, Number(previousState.scroll) || 0); if (searchLive) searchLive.textContent += ' 이전 문서는 현재 열람 범위에 없습니다.'; }
              });
            }
          } catch (error) {
            if (sequence !== searchSequence || error?.name === 'AbortError') return;
            if (append && resultsBody) {
              resultsBody.querySelector('[data-search-more]')?.closest('nav')?.remove();
              resultsBody.querySelector('[data-search-retry]')?.closest('nav')?.remove();
              resultsBody.insertAdjacentHTML('beforeend', '<nav class="pagination"><span role="alert">다음 결과를 불러오지 못했습니다.</span><button type="button" class="button secondary sm" data-search-retry>다시 시도</button></nav>');
            } else renderError(error?.message);
          } finally {
            if (sequence === searchSequence) viewerApp.setAttribute('aria-busy', 'false');
          }
        };

        var scheduleSearch = function () {
          clearTimeout(renderTimer);
          invalidateSearch();
          syncWorkspaceReturnTo();
          syncFilterUi();
          if (composing) return;
          renderTimer = setTimeout(function () { syncBrowserUrl(); requestSearch('', false); }, 180);
        };
        viewerInput.addEventListener('compositionstart', function () { composing = true; clearTimeout(renderTimer); invalidateSearch(); });
        viewerInput.addEventListener('compositionend', function () { composing = false; scheduleSearch(); });
        viewerInput.addEventListener('input', function (event) { if (!event.isComposing) scheduleSearch(); });
        viewerForm.addEventListener('submit', function (event) {
          event.preventDefault();
          if (composing || event.isComposing) return;
          invalidateSearch(); syncBrowserUrl(); requestSearch('', false);
        });
        document.addEventListener('change', function (event) {
          var control = event.target instanceof Element ? event.target : null;
          if (!control || control.form !== viewerForm || control === viewerInput) return;
          clearTimeout(renderTimer);
          invalidateSearch();
          syncWorkspaceReturnTo();
          syncFilterUi();
          syncBrowserUrl();
          requestSearch('', false);
        });
        mobileFilterForm?.addEventListener?.('submit', function (event) {
          event.preventDefault();
          filterNames.forEach(function (name) { setFormValue(viewerForm, name, formControl(mobileFilterForm, name)?.value || ''); });
          clearTimeout(renderTimer);
          syncWorkspaceReturnTo();
          syncFilterUi();
          mobileFilterDialog?.close();
          restoreState = null;
          syncBrowserUrl();
          requestSearch('', false);
        });
        document.addEventListener('click', function (event) {
          var target = event.target instanceof Element ? event.target : null;
          if (!target) return;
          if (target.closest('[data-open-modal="viewer-filter-dialog"]')) {
            syncMobileFilters();
            return;
          }
          var setFilter = target.closest('[data-viewer-set-filter]');
          if (setFilter) {
            event.preventDefault();
            setFormValue(viewerForm, setFilter.dataset.viewerSetFilter, setFilter.dataset.viewerFilterValue || '');
            syncWorkspaceReturnTo();
            syncFilterUi();
            syncBrowserUrl();
            restoreState = null;
            requestSearch('', false);
            return;
          }
          var clearFilter = target.closest('[data-viewer-clear-filter]');
          if (clearFilter) {
            event.preventDefault();
            var name = clearFilter.dataset.viewerClearFilter;
            setFormValue(viewerForm, name, name === 'status' ? 'active' : '');
            if (name === 'rack') ['face','column','shelf'].forEach(function (part) { setFormValue(viewerForm, part, ''); });
            syncWorkspaceReturnTo();
            syncFilterUi();
            syncBrowserUrl();
            restoreState = null;
            requestSearch('', false);
            return;
          }
          var removeToken = target.closest('[data-viewer-remove-token]');
          if (removeToken) {
            event.preventDefault();
            removeQueryToken(removeToken.dataset.viewerRemoveToken || '');
            syncWorkspaceReturnTo();
            syncFilterUi();
            syncBrowserUrl();
            restoreState = null;
            requestSearch('', false);
            return;
          }
          var reset = target.closest('[data-viewer-filter-reset], [data-viewer-search-reset]');
          if (!reset) return;
          event.preventDefault();
          var clearQuery = reset.hasAttribute('data-viewer-search-reset');
          if (clearQuery) viewerInput.value = '';
          filterNames.forEach(function (name) {
            setFormValue(viewerForm, name, name === 'status' ? 'active' : name === 'sort' ? 'relevance' : '');
          });
          clearTimeout(renderTimer);
          syncWorkspaceReturnTo();
          syncFilterUi();
          mobileFilterDialog?.close();
          restoreState = null;
          syncBrowserUrl();
          requestSearch('', false);
        });
        resultsBody?.addEventListener?.('click', function (event) {
          var target = event.target instanceof Element ? event.target : null;
          if (target?.closest('[data-search-retry]')) { requestSearch(retryCursor, Boolean(retryCursor)); return; }
          if (target?.closest('[data-search-more]') && currentCursor) requestSearch(currentCursor, true);
        });
        syncFilterUi();
        // 첫 화면은 서버 조회를 재사용한다. 상세 복귀만 최신 데이터로 다시 조회한다.
        if (viewerContext.initialResults && !restoreState) {
          renderPayload(viewerContext.initialResults, false);
          viewerApp.setAttribute('aria-busy', 'false');
        } else requestSearch('', false);
      }

      var workspaceSearch = document.querySelector('[data-viewer-form] input[name="q"]');
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

      document.querySelectorAll('[data-document-form], [data-revision-form], [data-movement-form], [data-dirty-form]').forEach(function (form) {
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
            var previousErrorIds = new Set();
            form.querySelectorAll('.field-error').forEach(function (error) { previousErrorIds.add(error.id); error.remove(); });
            form.querySelectorAll('[aria-invalid="true"]').forEach(function (field) {
              field.removeAttribute('aria-invalid');
              var descriptions = (field.getAttribute('aria-describedby') || '').split(' ').filter(function (id) { return id && !previousErrorIds.has(id); });
              if (descriptions.length) field.setAttribute('aria-describedby', descriptions.join(' ')); else field.removeAttribute('aria-describedby');
            });
            feedback.className = 'form-error-summary'; feedback.setAttribute('role', 'alert'); feedback.replaceChildren();
            var message = document.createElement('p'); message.textContent = summary.textContent.trim(); feedback.appendChild(message);
            parsed.querySelectorAll('[aria-invalid="true"]').forEach(function (field) {
              var current = document.getElementById(field.id);
              if (!current || !form.contains(current)) return;
              if (current.closest('.enhanced-control-hidden')) current = form.querySelector(field.id === 'field-rackFace' ? '#field-locationFace' : '#field-locationZone') || current;
              current.setAttribute('aria-invalid', 'true');
              var descriptions = (field.getAttribute('aria-describedby') || '').split(' ').map(function (id) { return parsed.getElementById(id); }).filter(function (element) { return element?.classList.contains('field-error'); });
              var errorText = descriptions.map(function (element) { return element.textContent.trim(); }).join(' ') || '입력값을 확인하세요.';
              var inlineError = document.createElement('p'); inlineError.className = 'field-error'; inlineError.id = 'response-error-' + current.id; inlineError.textContent = errorText;
              (current.closest('label') || current).insertAdjacentElement('afterend', inlineError);
              current.setAttribute('aria-describedby', ((current.getAttribute('aria-describedby') || '') + ' ' + inlineError.id).trim());
              var link = document.createElement('a'); link.href = '#' + current.id;
              var label = parsed.querySelector('label[for="' + field.id + '"]');
              link.textContent = (label?.textContent || field.name) + ': ' + errorText; feedback.appendChild(link);
            });
            var latest = document.createElement('a');
            latest.href = form.action.replace(/\/(edit|revise|move)$/, ''); latest.target = '_blank'; latest.rel = 'noopener'; latest.textContent = '최신 내용 별도 확인'; feedback.appendChild(latest);
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
        if (summary) summary.textContent = revisionField.value ? 'Rev.' + revisionField.value.replace(/^Rev\./i, '') : '신규 개정 입력';
      });

    });

