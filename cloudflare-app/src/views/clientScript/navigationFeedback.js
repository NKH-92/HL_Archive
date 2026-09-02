// 전역 클라이언트 스크립트의 활성 내비·토스트·검색 클릭 집계 조각. 실행 순서는 clientScript.js에서 고정한다.

export const TOAST_MESSAGES = Object.freeze({
  created: "문서가 등록되었습니다.",
  "document-created": "문서가 등록되어 세트에 추가되었습니다.",
  updated: "문서 정보가 수정되었습니다.",
  revised: "새 개정 문서가 등록되었습니다.",
  moved: "문서 위치가 이동되었습니다.",
  disposed: "폐기 처리되었습니다.",
  restored: "폐기가 해제되었습니다.",
  deleted: "문서가 완전 삭제되었습니다.",
  saved: "저장되었습니다.",
  "bulk-disposed": "선택한 문서를 폐기 처리했습니다.",
  approved: "가입 요청을 승인했습니다.",
  rejected: "가입 요청을 거절했습니다.",
  enabled: "사용자 계정을 활성화했습니다.",
  disabled: "사용자 계정을 비활성화했습니다.",
  "permissions-saved": "사용자 권한을 저장했습니다.",
  "template-saved": "역할 템플릿을 저장했습니다.",
  "template-applied": "선택한 사용자에게 역할 템플릿을 반영했습니다.",
  "password-reset": "임시 비밀번호를 설정했습니다. 다음 로그인에서 비밀번호 변경이 강제됩니다.",
  "password-changed": "비밀번호가 변경되었습니다.",
  "user-deleted": "계정을 완전삭제했습니다.",
  "user-created": "승인 사용자를 추가했습니다. 임시 비밀번호를 안전하게 전달하세요.",
  "set-locked": "준비 문서 세트를 잠갔습니다.",
  "set-unlocked": "준비 문서 세트의 잠금을 해제했습니다.",
  error: "요청을 처리하지 못했습니다. 입력값을 확인하세요."
});

export function navigationFeedbackScript() {
  const toastMessages = JSON.stringify(TOAST_MESSAGES);
  return `      var currentPath = location.pathname;
      var currentUrl = new URL(location.href);
      var activeNavItems = Array.from(document.querySelectorAll('.archive-nav-item, .nav-sub-link, [data-command-item]')).filter(function (item) {
        var href = item.getAttribute('href') || '';
        if (!href) return false;
        var itemUrl = new URL(href, location.origin);
        var pathMatches = itemUrl.pathname === currentPath || (itemUrl.pathname.length > 1 && currentPath.indexOf(itemUrl.pathname + '/') === 0);
        var queryMatches = Array.from(itemUrl.searchParams.entries()).every(function (entry) {
          return currentUrl.searchParams.getAll(entry[0]).includes(entry[1]);
        });
        return pathMatches && queryMatches;
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
        var toastMessages = ${toastMessages};
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
`;
}
