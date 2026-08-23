// 전역 클라이언트 스크립트의 즉시 검색 조각. 대용량 전환부터 브라우저 전체 인덱스를 받지 않는다.

export function instantSearchScript() {
  return `      // 서버 즉시 검색: Core projection 후보 → Core 재검증 → 최대 30건 cursor 응답.
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
          viewerInput.value = viewerInput.value.trim().split(/\\s+/).filter(function (part) {
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
`;
}
