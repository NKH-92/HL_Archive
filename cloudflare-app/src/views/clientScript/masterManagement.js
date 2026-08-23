// 대분류 목록은 항목 수가 늘어도 서버 재요청 없이 이름·설명과 사용 상태로 좁혀 본다.

export function masterManagementScript() {
  return `      document.querySelectorAll('[data-master-management]').forEach(function (root) {
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
      });`;
}
