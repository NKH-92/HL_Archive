// 전역 CSS의 검색과 문서 결과 조각. 순서는 styles.js에서 고정한다.

export function searchStyles() {
  return `    .search-band { display: grid; gap: var(--sp-3); }
    .viewer-search-form { display: grid; gap: var(--sp-2); }
    .viewer-search-form .search-box input { min-height: 40px; font-size: 14px; }
    .filter-details summary { display: inline-flex; align-items: center; gap: var(--sp-2); width: max-content; padding: var(--sp-1); color: var(--gray-500); font-size: 12.5px; font-weight: 600; cursor: pointer; list-style: none; border-radius: var(--r-sm); }
    .filter-details summary::-webkit-details-marker { display: none; }
    .filter-details summary:hover { color: var(--gray-700); }
    .filter-details summary i { font-size: .85em; }
    .filter-details[open] summary { margin-bottom: var(--sp-2); color: var(--gray-700); }
    .filter-count { display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding: 0 var(--sp-1); border-radius: 999px; background: var(--primary); color: var(--surface); font-size: 11px; font-weight: 700; }
    .viewer-filter-row { display: grid; grid-template-columns: repeat(4, minmax(110px, 1fr)) auto; gap: var(--sp-2); align-items: center; }
    .quick-filter-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2); color: var(--gray-500); font-weight: 600; font-size: 12.5px; }
    .quick-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2); color: var(--gray-500); font-weight: 600; font-size: 12.5px; }

    .filter-bar { display: grid; gap: var(--sp-2); }
    .search-box { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: var(--sp-2); padding: var(--sp-1) var(--sp-1) var(--sp-1) var(--sp-3); background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-md); transition: border-color .15s ease, box-shadow .15s ease; }
    .search-box:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px var(--ring); }
    .search-box i { color: var(--gray-500); }
    .search-box input { background: transparent; border: 0; min-height: 36px; padding: 0 var(--sp-1); }
    .search-box input:focus { outline: 0; box-shadow: none; border: 0; background: transparent; }

    input, select, textarea { width: 100%; min-height: 36px; padding: var(--sp-2) var(--sp-3); border: 1px solid var(--line); border-radius: var(--r-md); background: var(--surface); color: var(--ink); font: inherit; font-size: 13.5px; transition: border-color .15s ease, box-shadow .15s ease; }
    textarea { resize: vertical; }
    input::placeholder, textarea::placeholder { color: var(--gray-500); }
    input:hover, select:hover, textarea:hover { border-color: var(--gray-300); }
    input:focus, select:focus, textarea:focus { outline: 0; border-color: var(--primary); box-shadow: 0 0 0 3px var(--ring); }
    label { display: block; font-weight: 600; font-size: 12.5px; color: var(--gray-600); }
    label > input, label > select, label > textarea { margin-top: var(--sp-1); }
    em { color: var(--danger); font-style: normal; }

    button, .button { display: inline-flex; align-items: center; justify-content: center; gap: var(--sp-2); min-height: 36px; padding: var(--sp-2) var(--sp-4); border: 1px solid transparent; border-radius: var(--r-md); background: var(--primary); color: var(--surface); font: inherit; font-weight: 600; font-size: 13.5px; text-decoration: none; cursor: pointer; white-space: nowrap; transition: background .15s ease, border-color .15s ease, color .15s ease; }
    button:hover, .button:hover { background: var(--primary-strong); }
    .button.secondary, button.secondary, .secondary { background: var(--surface); border-color: var(--line); color: var(--gray-700); }
    .button.secondary:hover, button.secondary:hover, .secondary:hover { background: var(--gray-50); border-color: var(--gray-300); color: var(--gray-900); }
    .danger-button, .button.danger-button { background: var(--danger-soft); color: var(--danger); border: 1px solid transparent; }
    .danger-button:hover, .button.danger-button:hover { background: var(--danger); color: var(--surface); }
    .sm { min-height: 30px; padding: var(--sp-1) var(--sp-3); font-size: 12.5px; border-radius: var(--r-sm); }
    .icon-button { min-height: 36px; width: 36px; padding: 0; background: transparent; color: var(--gray-600); border-radius: var(--r-sm); }
    .icon-button:hover { background: var(--gray-100); color: var(--gray-700); }
    .disabled { pointer-events: none; opacity: .45; }
    button:disabled { opacity: .45; pointer-events: none; }
    button:focus-visible, .button:focus-visible, a:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }

    .panel { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: var(--sp-5); margin-bottom: var(--sp-4); }
    .narrow { max-width: 640px; margin-inline: auto; }
    .content-grid { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(280px, .8fr); gap: var(--sp-4); align-items: start; }
    .viewer-workspace { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--sp-4); align-items: start; }
    .viewer-preview > strong { font-size: 16px; }
    .viewer-preview > p { margin: 0; color: var(--primary); }
    .viewer-preview dl { display: grid; gap: var(--sp-2); margin: 0; }
    .viewer-preview dl div { display: grid; grid-template-columns: 84px minmax(0, 1fr); gap: var(--sp-2); }
    .viewer-preview dt { color: var(--gray-500); font-size: 12px; font-weight: 600; }
    .viewer-preview dd { margin: 0; }
    .two-col, .admin-grid, .rack-grid { display: grid; gap: var(--sp-3); grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); }
    .section-title { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-3); }
    .filter-row { display: grid; grid-template-columns: repeat(5, minmax(110px, 1fr)); gap: var(--sp-2); }
    .stack { display: grid; gap: var(--sp-4); }
    .button-group { display: flex; flex-wrap: wrap; gap: var(--sp-2); align-items: center; }

    .metric-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); margin-bottom: var(--sp-4); }
    .metric-card { padding: var(--sp-4) var(--sp-5); display: grid; gap: var(--sp-1); }
    .metric-card + .metric-card { border-left: 1px solid var(--line); }
    .metric-card span { color: var(--gray-500); font-size: 12px; font-weight: 600; }
    .metric-card strong { font-size: 22px; font-weight: 700; line-height: 1.2; letter-spacing: 0; }
    .metric-card small { color: var(--gray-500); font-size: 12px; }

    .count-badge { display: inline-flex; align-items: center; padding: 0 var(--sp-2); line-height: 20px; border-radius: 999px; background: var(--gray-100); color: var(--gray-600); font-size: 12px; font-weight: 600; white-space: nowrap; }
    .chip { display: inline-flex; align-items: center; gap: var(--sp-1); padding: var(--sp-1) var(--sp-3); border-radius: 999px; background: var(--surface); border: 1px solid var(--line); color: var(--gray-600); font-size: 12.5px; font-weight: 600; text-decoration: none; transition: background .15s ease, color .15s ease, border-color .15s ease; }
    .chip:hover { background: var(--gray-50); color: var(--gray-900); }
    .chip.active { background: var(--primary-soft); border-color: var(--primary-soft); color: var(--primary); }
    .quality-strip { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-bottom: var(--sp-4); }
    .quality-strip .warn { display: inline-flex; align-items: center; gap: var(--sp-1); padding: var(--sp-1) var(--sp-3); border-radius: 999px; background: var(--warning-soft); color: var(--warning); font-size: 12.5px; font-weight: 600; }


    .search-live-status { margin: 0; color: var(--gray-500); font-size: 12.5px; }
    .viewer-result-table { overflow-x: auto; }
    .viewer-results-heading, .viewer-result-tools { display: flex; align-items: center; gap: var(--sp-3); }
    .viewer-result-tools { margin-left: auto; }
    .column-settings { position: relative; }
    .column-settings summary { cursor: pointer; color: var(--gray-600); font-size: 12px; font-weight: 600; list-style: none; }
    .column-settings summary::-webkit-details-marker { display: none; }
    .column-settings > label { position: absolute; z-index: 5; right: 0; top: calc(100% + var(--sp-2)); min-width: 150px; padding: var(--sp-3); border: 1px solid var(--line); border-radius: var(--r-md); background: var(--surface); box-shadow: var(--shadow-1); }
    .column-settings input { width: auto; min-height: auto; margin: 0 var(--sp-1) 0 0; }
    .active-filter-chips { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
    .match-line { color: var(--gray-500); }

    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    th, td { padding: var(--sp-2) var(--sp-3); border-bottom: 1px solid var(--gray-100); text-align: left; }
    th { background: var(--gray-50); color: var(--gray-600); font-size: 12px; font-weight: 600; white-space: nowrap; border-bottom: 1px solid var(--line); }
    tbody tr { transition: background .12s ease; }
    tbody tr:hover { background: var(--gray-50); }
    tr.is-disposed td:first-child { border-left: 3px solid var(--gray-300); }
    .check-col { display: grid; width: 44px; min-height: 44px; place-items: center; }
    .check-col input { width: auto; min-height: auto; accent-color: var(--primary); }
    .bulk-check-target { display: grid; width: 44px; min-height: 44px; place-items: center; cursor: pointer; }
    .bulk-select-all-label { display: inline-flex; align-items: center; gap: var(--sp-2); color: var(--gray-700); font-size: 12.5px; font-weight: 600; cursor: pointer; }
    .workspace-bulk-bar { gap: var(--sp-3); }
    .workspace-set-form { display: flex; align-items: center; gap: var(--sp-2); }
    .workspace-set-form select { min-width: 180px; margin: 0; }
    .loc-cell { white-space: nowrap; }
    .loc-cell-main { display: block; font-family: var(--font-mono); font-size: 12.5px; font-weight: 600; color: var(--primary); }
    .loc-cell-sub { display: block; color: var(--gray-500); font-size: 11.5px; }
    .mono-cell { font-family: var(--font-mono); font-size: 12.5px; white-space: nowrap; }
    .name-cell a { font-weight: 600; text-decoration: none; }
    .name-cell a:hover { color: var(--primary); text-decoration: underline; }
    .name-cell small { display: block; color: var(--gray-500); font-size: 12px; margin-top: var(--sp-1); }
    .status { display: inline-flex; align-items: center; width: max-content; padding: 0 var(--sp-2); line-height: 20px; border-radius: 999px; font-size: 11.5px; font-weight: 700; }
    .status.document-active, .status.master-active, .status.account-approved, .status.campaign-completed, .status.import-completed, .status.snapshot-completed, .status.change-created { background: var(--success-soft); color: var(--success); }
    .status.document-disposed, .status.master-inactive, .status.account-disabled, .status.account-rejected, .status.campaign-cancelled, .status.import-cancelled, .status.snapshot-cancelled, .status.change-neutral { background: var(--gray-100); color: var(--gray-700); }
    .status.account-pending, .status.ledger-excluded, .status.review-pending, .status.campaign-pending, .status.import-pending, .status.snapshot-pending, .status.change-updated { background: var(--warning-soft); color: var(--warning); }
    .status.ledger-current, .status.policy-required { background: var(--primary-soft); color: var(--primary); }
    .status.account-review, .status.import-failed, .status.snapshot-failed, .status.campaign-failed { background: var(--danger-soft); color: var(--danger); }

    .index-list { display: grid; }
    .index-row { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-3); padding: var(--sp-2) var(--sp-1); border-bottom: 1px solid var(--gray-100); text-decoration: none; font-size: 13.5px; font-weight: 600; color: var(--gray-700); transition: color .15s ease; }
    .index-row:last-child { border-bottom: 0; }
    .index-row strong { color: var(--gray-500); font-weight: 600; font-size: 12.5px; }
    .index-row:hover, .index-row:hover strong { color: var(--primary); }
    .archive-map { display: grid; gap: var(--sp-3); min-width: 720px; }`;
}
