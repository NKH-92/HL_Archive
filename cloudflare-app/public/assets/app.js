// generated from src/views/clientScript.js; do not edit

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
        documentDetail.querySelectorAll('[data-back-to-results]').forEach(function (link) {
          link.addEventListener('click', function (event) {
            try {
              var previous = new URL(document.referrer || '', location.href);
              var sameSearchFlow = previous.origin === location.origin && (previous.pathname === '/app' || previous.pathname === '/documents');
              if (!sameSearchFlow || history.length < 2) return;
              event.preventDefault();
              history.back();
            } catch {}
          });
        });

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
      var activeNavItems = Array.from(document.querySelectorAll('.archive-nav-item, .nav-sub-link, [data-command-item]')).filter(function (item) {
        var href = item.getAttribute('href') || '';
        return href === currentPath || (href.length > 1 && currentPath.indexOf(href + '/') === 0);
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
      // 서버 즉시 검색: Core projection 후보 → Core 재검증 → 최대 30건 cursor 응답.
      var viewerApp = document.querySelector('[data-viewer-app]');
      var viewerForm = document.querySelector('[data-viewer-form]');
      var viewerInput = viewerForm ? viewerForm.querySelector('input[name="q"]') : null;
      if (viewerApp && viewerInput && window.SearchCore) {
        var resultsBody = document.querySelector('[data-results-body]');
        var resultsTitle = document.querySelector('[data-results-title]');
        var resultsCount = document.querySelector('[data-results-count]');
        var searchLive = document.querySelector('[data-search-live]');
        var homeExtras = document.querySelector('[data-home-extras]');
        var activeFilterChips = document.querySelector('[data-active-filter-chips]');
        var parsedFilterChips = document.querySelector('[data-parsed-filter-chips]');
        var mobileFilterForm = document.querySelector('[data-mobile-viewer-filter]');
        var mobileFilterDialog = mobileFilterForm?.closest('dialog') || null;
        var viewerContextElement = document.querySelector('[data-viewer-context]');
        var viewerContext = { categories: [], tags: [], racks: [], explicitFilters: {} };
        try { viewerContext = JSON.parse(viewerContextElement?.textContent || '{}'); } catch {}
        var isHomeMode = viewerApp.classList.contains('is-home');
        var workspaceSelectable = Boolean(document.querySelector('[data-document-selection]'));
        var initialResults = {
          body: resultsBody ? resultsBody.innerHTML : '',
          title: resultsTitle ? resultsTitle.textContent : '',
          count: resultsCount ? resultsCount.textContent : '',
          status: searchLive ? searchLive.textContent : ''
        };
        var renderTimer = null;
        var activeRequest = null;
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

        var restoreInitial = function () {
          if (activeRequest) activeRequest.abort();
          currentCursor = ''; currentItems = [];
          replaceResults(initialResults.body, false);
          if (resultsTitle) resultsTitle.textContent = initialResults.title;
          if (resultsCount) resultsCount.textContent = initialResults.count;
          if (searchLive) searchLive.textContent = initialResults.status;
          if (homeExtras) homeExtras.hidden = false;
          if (isHomeMode) viewerApp.hidden = false;
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

        var hasActiveSearchCriteria = function () {
          if (viewerInput.value.trim()) return true;
          if (['category','tag','zone','rack','face','column','shelf'].some(function (name) { return Boolean(formValue(name)); })) return true;
          if (formValue('status') && formValue('status') !== 'active') return true;
          return Boolean(formValue('sort') && formValue('sort') !== 'relevance');
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
          var location = item.location || {};
          var disposed = item.status === 'disposed';
          var itemName = item.documentName || '문서명 없음';
          var itemNumber = item.documentNumber || '';
          var itemRevision = item.revisionLabel || item.revisionNumber || 'N/A';
          var itemCategory = item.categoryName || '-';
          var itemLocation = location.label || '위치 미지정';
          return '<article class="viewer-result-row' + (workspaceSelectable ? ' is-selectable' : '') + (disposed ? ' is-disposed' : '') + '" role="row" tabindex="0" aria-selected="false" data-document-row data-document-url="/documents/' + Number(item.id) + '" data-document-name="' + escapeHtmlClient(itemName) + '" data-document-number="' + escapeHtmlClient(itemNumber) + '" data-document-revision="' + escapeHtmlClient(itemRevision) + '" data-document-category="' + escapeHtmlClient(itemCategory) + '" data-document-location="' + escapeHtmlClient(itemLocation) + '" data-document-status="' + (disposed ? '폐기' : '보관중') + '">' +
            (workspaceSelectable ? '<span class="check-col" role="cell" data-label="선택"><label class="bulk-check-target"><input type="checkbox" value="' + Number(item.id) + '" data-bulk-item aria-label="' + escapeHtmlClient(itemName) + ' 선택"></label></span>' : '') +
            '<span class="viewer-result-name" role="cell" data-label="문서명"><a href="/documents/' + Number(item.id) + '" data-doc-click="' + Number(item.id) + '">' + window.SearchCore.highlightHtml(itemName, query, escapeHtmlClient) + '</a></span>' +
            '<span class="mono" role="cell" data-label="문서번호/개정"><span class="viewer-result-value">' + window.SearchCore.highlightHtml(itemNumber, query, escapeHtmlClient) + ' <small>' + escapeHtmlClient(itemRevision) + '</small></span></span>' +
            '<span class="viewer-result-detail-only" role="cell" data-label="대분류">' + escapeHtmlClient(itemCategory) + '</span>' +
            '<span class="viewer-result-location viewer-result-detail-only" role="cell" data-label="보관 위치">' + escapeHtmlClient(itemLocation) + '</span>' +
            '<span class="viewer-result-detail-only" role="cell" data-label="상태"><span class="status ' + (disposed ? 'document-disposed' : 'document-active') + '">' + (disposed ? '폐기' : '보관중') + '</span></span>' +
            '<span class="optional-column viewer-result-detail-only" data-column="revision-date" role="cell" data-label="제·개정일" hidden>' + escapeHtmlClient(item.revisionDate || '-') + '</span>' +
            '</article>';
        };

        var renderPayload = function (payload, append) {
          var query = parsedSearch().text;
          var incomingItems = payload.items || [];
          currentItems = append ? currentItems.concat(incomingItems) : incomingItems;
          currentCursor = payload.nextCursor || '';
          var listHtml = incomingItems.map(function (item) { return resultRow(item, query); }).join('');
          var html = '<div class="viewer-result-table' + (workspaceSelectable ? ' is-selectable' : '') + '" role="grid" aria-label="문서 검색 결과">' +
            '<div class="viewer-result-header" role="row">' + (workspaceSelectable ? '<span class="check-col" role="columnheader"><span class="sr-only">선택</span></span>' : '') + '<span role="columnheader">문서명</span><span role="columnheader">문서번호 · 개정</span><span role="columnheader">대분류</span><span role="columnheader">보관 위치</span><span role="columnheader">상태</span><span class="optional-column" data-column="revision-date" role="columnheader" hidden>제·개정일</span></div>' +
            '<div class="viewer-result-list" role="rowgroup">' + listHtml + '</div></div>';
          if (!currentItems.length) {
            html = '<div class="empty-state"><i class="fa-regular fa-folder-open"></i><p>조건에 맞는 문서가 없습니다.</p><div class="empty-actions"><a class="button secondary sm" href="/app" data-viewer-search-reset>검색 초기화</a></div></div>';
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
          if (resultsTitle) resultsTitle.textContent = query ? '"' + query + '" 검색 결과' : (hasActiveSearchCriteria() ? '필터 검색 결과' : '최근 등록·수정 문서');
          var hasKnownTotal = payload.candidateCount !== null && payload.candidateCount !== undefined;
          var totalFound = hasKnownTotal ? Number(payload.candidateCount) : currentItems.length;
          if (resultsCount) resultsCount.textContent = totalFound.toLocaleString('ko-KR') + (hasKnownTotal || !payload.hasMore ? '건' : '+건');
          if (searchLive) {
            searchLive.textContent = !currentItems.length
              ? '검색 결과가 없습니다.'
              : !hasKnownTotal && payload.hasMore
                ? currentItems.length.toLocaleString('ko-KR') + '건을 표시했습니다. 더보기로 이어서 확인하세요.'
                : currentItems.length < totalFound
                ? totalFound.toLocaleString('ko-KR') + '건 중 ' + currentItems.length.toLocaleString('ko-KR') + '건을 표시했습니다. 더보기로 이어서 확인하세요.'
                : totalFound.toLocaleString('ko-KR') + '건을 모두 표시했습니다.';
          }
          if (homeExtras) homeExtras.hidden = true;
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

        var requestSearch = async function (cursor, append) {
          if (!hasActiveSearchCriteria() && isHomeMode) { restoreInitial(); return; }
          if (activeRequest) activeRequest.abort();
          activeRequest = typeof AbortController === 'function' ? new AbortController() : null;
          if (searchLive) searchLive.textContent = append ? '다음 결과를 불러오는 중…' : '검색 중…';
          try {
            var response = await fetch('/api/viewer/search?' + searchRequestParams(cursor).toString(), {
              headers: { Accept: 'application/json' },
              ...(activeRequest ? { signal: activeRequest.signal } : {})
            });
            var payload = await response.json().catch(function () { return {}; });
            if (response.status === 409 && payload.code === 'SEARCH_CURSOR_STALE') {
              return requestSearch('', false);
            }
            if (!response.ok || payload.ok === false || !Array.isArray(payload.items)) {
              throw new Error(payload.message || '검색 요청에 실패했습니다.');
            }
            window.__hanlimSearchIndexReady = true;
            var datalist = viewerInput.parentElement?.querySelector?.('[data-suggest-list]');
            if (datalist && Array.isArray(payload.suggestions)) {
              datalist.innerHTML = payload.suggestions.map(function (item) {
                return '<option value="' + escapeHtmlClient(item.value) + '">' + escapeHtmlClient(item.label || item.value) + '</option>';
              }).join('');
            }
            renderPayload(payload, append);
          } catch (error) {
            if (error && error.name === 'AbortError') return;
            renderError(error && error.message);
          }
        };

        viewerInput.addEventListener('input', function () {
          clearTimeout(renderTimer);
          syncWorkspaceReturnTo();
          syncFilterUi();
          if (!hasActiveSearchCriteria() && isHomeMode) { syncBrowserUrl(); restoreInitial(); return; }
          renderTimer = setTimeout(function () { syncBrowserUrl(); requestSearch('', false); }, 180);
        });
        document.addEventListener('change', function (event) {
          var control = event.target instanceof Element ? event.target : null;
          if (!control || control.form !== viewerForm || control === viewerInput) return;
          clearTimeout(renderTimer);
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
          syncBrowserUrl();
          requestSearch('', false);
        });
        resultsBody?.addEventListener?.('click', function (event) {
          var target = event.target instanceof Element ? event.target : null;
          if (target?.closest('[data-search-retry]')) { requestSearch('', false); return; }
          if (target?.closest('[data-search-more]') && currentCursor) requestSearch(currentCursor, true);
        });
        syncFilterUi();
        if (viewerInput.value.trim()) requestSearch('', false);
      }

      var workspaceSearch = document.querySelector('[data-viewer-form] input[name="q"]');
      var workspacePreview = document.querySelector('[data-document-preview]');
      var columnToggle = document.querySelector('[data-column-toggle="revision-date"]');

      var applyRevisionColumn = function (visible) {
        document.querySelectorAll('[data-column="revision-date"]').forEach(function (cell) {
          cell.hidden = !visible;
        });
        document.querySelectorAll('.viewer-result-table').forEach(function (table) {
          table.classList.toggle('show-revision-date', visible);
        });
        if (columnToggle) columnToggle.checked = visible;
      };

      if (columnToggle) {
        var storedColumns = '';
        try { storedColumns = localStorage.getItem('hanlimDocumentColumns') || ''; } catch {}
        applyRevisionColumn(storedColumns.split(',').includes('revision-date'));
        columnToggle.addEventListener('change', function () {
          applyRevisionColumn(columnToggle.checked);
          try { localStorage.setItem('hanlimDocumentColumns', columnToggle.checked ? 'revision-date' : ''); } catch {}
        });
      }

      var fillPreview = function (row) {
        if (!workspacePreview || !row) return;
        var setText = function (selector, value) {
          var target = workspacePreview.querySelector(selector);
          if (target) target.textContent = value || '-';
        };
        setText('[data-preview-name]', row.dataset.documentName);
        setText('[data-preview-number]', (row.dataset.documentNumber || '') + ' · ' + (row.dataset.documentRevision || '-'));
        setText('[data-preview-category]', row.dataset.documentCategory);
        setText('[data-preview-location]', row.dataset.documentLocation);
        setText('[data-preview-status]', row.dataset.documentStatus);
        var link = workspacePreview.querySelector('[data-preview-link]');
        if (link) link.href = row.dataset.documentUrl || '/app';
        document.querySelectorAll('[data-document-row]').forEach(function (item) {
          item.classList.toggle('is-selected', item === row);
          item.setAttribute('aria-selected', item === row ? 'true' : 'false');
        });
        workspacePreview.hidden = false;
      };

      document.addEventListener('click', function (event) {
        var target = event.target instanceof Element ? event.target : null;
        if (target?.closest('[data-preview-close]')) {
          if (workspacePreview) workspacePreview.hidden = true;
          document.querySelectorAll('[data-document-row]').forEach(function (item) {
            item.classList.remove('is-selected');
            item.setAttribute('aria-selected', 'false');
          });
          return;
        }
        var row = target?.closest('[data-document-row]');
        if (!row || target.closest('a, button, input, select, textarea, label')) return;
        if (window.matchMedia?.('(min-width: 1180px)').matches && workspacePreview) {
          fillPreview(row);
          return;
        }
        if (row.dataset.documentUrl) location.assign(row.dataset.documentUrl);
      });

      document.addEventListener('keydown', function (event) {
        var target = event.target instanceof Element ? event.target : null;
        var editing = target?.matches('input, textarea, select, [contenteditable="true"]');
        if (event.key === '/' && !editing && workspaceSearch) {
          event.preventDefault();
          workspaceSearch.focus();
          workspaceSearch.select();
          return;
        }
        var row = target?.closest('[data-document-row]');
        if (!row) return;
        var rows = Array.from(document.querySelectorAll('[data-document-row]'));
        var index = rows.indexOf(row);
        if (event.key === 'ArrowDown' && rows[index + 1]) {
          event.preventDefault();
          rows[index + 1].focus();
          if (window.matchMedia?.('(min-width: 1180px)').matches) fillPreview(rows[index + 1]);
        } else if (event.key === 'ArrowUp' && rows[index - 1]) {
          event.preventDefault();
          rows[index - 1].focus();
          if (window.matchMedia?.('(min-width: 1180px)').matches) fillPreview(rows[index - 1]);
        } else if (event.key === 'Enter' && row.dataset.documentUrl) {
          event.preventDefault();
          location.assign(row.dataset.documentUrl);
        }
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

    });

