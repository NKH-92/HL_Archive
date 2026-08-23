// 전역 CSS의 반응형과 인쇄 조각. 순서는 styles.js에서 고정한다.

export function responsivePrintStyles() {
  return `    @media (min-width: 1100px) {
      .topbar { position: fixed; inset: 0 auto 0 0; width: 240px; flex-direction: column; align-items: stretch; padding: var(--sp-4) var(--sp-3); border-right: 1px solid var(--line); border-bottom: 0; }
      .topbar nav { flex-direction: column; align-items: stretch; gap: var(--sp-1); padding-right: var(--sp-1); }
      .nav-group { width: 100%; }
      .brand { padding: var(--sp-1) var(--sp-2) var(--sp-3); border-bottom: 1px solid var(--line); margin-bottom: var(--sp-2); }
      .archive-nav-item, .nav-sub-link, .logout-link { justify-content: flex-start; }
      .nav-settings { display: block; }
      .nav-user { margin: auto 0 0; flex-direction: column; align-items: stretch; gap: var(--sp-1); padding-top: var(--sp-2); border-top: 1px solid var(--line); }
      .session-pill { border-radius: var(--r-md); white-space: normal; text-align: center; }
      .topbar ~ .app-shell { width: auto; max-width: 1440px; margin-left: calc(240px + var(--sp-6)); margin-right: var(--sp-6); }
      .bulk-bar { left: calc(240px + var(--sp-6)); right: max(var(--sp-6), calc(100vw - 240px - var(--sp-6) - 1440px)); }
      .drawer-close, .nav-scrim { display: none; }
    }
    @media (max-width: 1180px) {
      .viewer-workspace { grid-template-columns: 1fr; }
      .viewer-filter-row { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
    @media (max-width: 1099px) {
      .topbar { justify-content: space-between; }
      .drawer-close { display: inline-flex; align-self: flex-end; width: 44px; min-height: 44px; background: var(--surface); border: 1px solid var(--line); color: var(--ink); border-radius: var(--r-md); font-size: 15px; padding: 0; }
      .drawer-close:hover { background: var(--gray-50); }
      .topbar nav { position: fixed; inset: 0 0 0 auto; width: min(320px, 86vw); max-height: 100dvh; background: var(--surface); padding: var(--sp-4) var(--sp-4) max(var(--sp-4), env(safe-area-inset-bottom)); flex-direction: column; align-items: stretch; transform: translateX(100%); transition: transform .22s ease; box-shadow: var(--shadow-2); z-index: 60; -webkit-overflow-scrolling: touch; }
      .topbar nav:not(.is-open) { pointer-events: none; }
      .topbar nav.is-open { transform: translateX(0); }
      .nav-user { margin: auto 0 0; flex-direction: column; align-items: stretch; padding-top: var(--sp-2); border-top: 1px solid var(--line); }
      .nav-scrim.is-open { position: fixed; inset: 0; background: var(--scrim); z-index: 55; }
      .mobile-tabs { position: fixed; inset: auto 0 0; z-index: 45; display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); padding: 0 var(--sp-2) env(safe-area-inset-bottom); border-top: 1px solid var(--line); background: var(--surface); }
      .mobile-tab { min-height: 48px; min-width: 0; flex-direction: column; justify-content: center; gap: 0; padding: var(--sp-1); border: 0; border-radius: var(--r-md); background: transparent; color: var(--gray-600); font-size: 11px; text-align: center; }
      .mobile-tab span { width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .mobile-tab i { font-size: 14px; }
      .app-shell { padding-bottom: calc(var(--sp-8) + 48px + env(safe-area-inset-bottom)); }
      .bulk-bar, .app-toast { bottom: calc(48px + var(--sp-3) + env(safe-area-inset-bottom)); }
      .app-shell:has(.bulk-bar:not([hidden])) { padding-bottom: calc(var(--sp-8) + 48px + 120px + env(safe-area-inset-bottom)); }
    }
    @media (max-width: 1020px) {
      .content-grid { grid-template-columns: 1fr; }
      .filter-row, .disposal-filter { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .detail-grid { grid-template-columns: 1fr; gap: 0; }
    }
    @media print {
      .topbar, .mobile-tabs, .skip-nav, .nav-scrim, .button, button, form, .set-admin-tools, .archive-map, .app-toast { display: none !important; }
      .screen-only { display: none !important; }
      .print-only { display: block !important; }
      body { background: var(--surface); }
      .app-shell { width: 100%; padding: 0; }
      .panel { border: 1px solid var(--gray-300); }
      th, td { border-bottom: 1px solid var(--gray-300); }
      .page-head, .metric-strip, .set-lock-panel, .movement-history { display: none !important; }
      .set-print-header { margin-bottom: var(--sp-5); }
      .set-print-brand { display: flex; align-items: center; gap: var(--sp-3); margin-bottom: var(--sp-4); color: var(--gray-700); font-size: 14px; font-weight: 700; }
      .set-print-brand img { width: 82px; height: auto; }
      .set-print-header h1 { margin-bottom: var(--sp-2); font-size: 24px; }
      .set-print-header dl { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-3); margin-top: var(--sp-4); }
      .set-print-header dl div { border: 1px solid var(--gray-300); padding: var(--sp-2); }
      .set-print-header dt { color: var(--gray-500); font-size: 11px; }
      .set-print-header dd { margin: 0; font-weight: 700; }
      .print-check-column, .print-check-cell { display: table-cell !important; width: 44px; text-align: center; font-size: 18px; }
      .set-print-signatures { display: grid !important; grid-template-columns: repeat(2, 1fr); gap: var(--sp-6); margin-top: var(--sp-6); break-inside: avoid; }
      .set-print-signatures div { display: flex; align-items: end; gap: var(--sp-3); }
      .set-print-signatures span { flex: 1; height: 28px; border-bottom: 1px solid var(--gray-700); }
      .set-print-page { position: fixed; right: 0; bottom: 0; color: var(--gray-500); font-size: 11px; }
      .set-print-page span::after { content: counter(page); }
    }
    @media (max-width: 760px) {
      .app-shell { width: calc(100% - var(--sp-6)); padding-top: var(--sp-3); }
      .login-shell { grid-template-columns: 1fr; min-height: auto; }
      .login-side { display: flex; min-height: 164px; align-items: center; justify-content: center; padding: var(--sp-5); text-align: center; }
      .login-side .login-logo { width: 128px; }
      .login-side h1 { font-size: 18px; }
      .login-side p { display: none; }
      .login-panel { padding: var(--sp-6) var(--sp-5); }
      h1 { font-size: 17px; }
      .page-head, .locator-hero { flex-direction: column; align-items: stretch; }
      .document-title-row { flex-direction: column; align-items: stretch; }
      .document-detail-sections { grid-template-columns: 1fr; }
      .detail-section dl div { grid-template-columns: 96px minmax(0, 1fr); }
      .mini-rack-scroll { overflow-x: hidden; padding-inline: 0; scrollbar-gutter: auto; }
      .mini-rack-grid { inline-size: 100%; min-inline-size: 0; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: var(--sp-1); }
      .mini-slot { min-height: 40px; font-size: 11px; }
      .mini-slot i { display: none; }
      .document-form-layout { grid-template-columns: 1fr; }
      .form-review { position: static; order: -1; padding: var(--sp-4); }
      .form-review dl { margin-top: var(--sp-3); }
      .form-grid.two-column { grid-template-columns: 1fr; }
      .location-picker-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .location-picker-steps label:last-child { grid-column: 1 / -1; }
      .location-selection-preview { grid-template-columns: 1fr auto; }
      .location-selection-preview a { grid-column: 1 / -1; }
      /* 760px 이하에서는 sticky가 폼 끝에서만 붙어 저장 버튼과 완료도가 화면 밖에 남는다.
         하단 탭 위에 고정해 긴 폼 중간에서도 저장 상태를 유지하고, 폼 밖으로 스크롤하면
         (data-save-bar-parked) 다시 문서 흐름에 두어 후속 콘텐츠를 가리지 않는다. */
      .sticky-save-bar { position: fixed; inset: auto var(--sp-3) calc(48px + var(--sp-2) + env(safe-area-inset-bottom)) var(--sp-3); z-index: 40; }
      .sticky-save-bar[data-save-bar-parked] { position: static; inset: auto; }
      .document-form { padding-bottom: calc(96px + env(safe-area-inset-bottom)); }
      .document-form:has(.sticky-save-bar[data-save-bar-parked]) { padding-bottom: var(--sp-4); }
      .floor-plan-tools { align-items: stretch; flex-direction: column; }
      .floor-rack-search { flex: 0 1 auto; width: 100%; max-width: none; }
      .floor-plan-tools .button-group, .floor-plan-tools .button { width: 100%; }
      .floor-rack-inspector { position: fixed; inset: auto 0 0; z-index: 160; display: none; max-height: min(72vh, 560px); overflow-y: auto; margin: 0; padding: var(--sp-5) var(--sp-5) calc(var(--sp-5) + env(safe-area-inset-bottom)); border: 1px solid var(--line); border-radius: var(--r-lg) var(--r-lg) 0 0; background: var(--surface); box-shadow: var(--shadow-2); }
      .floor-rack-inspector.is-open { display: grid; }
      .floor-rack-inspector-close { display: inline-grid; }
      .document-toolbar { width: 100%; }
      .document-toolbar > * { flex: 1 1 150px; min-width: 0; }
      .search-box { grid-template-columns: auto minmax(0, 1fr); }
      .search-box button { grid-column: 1 / -1; width: 100%; }
      input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), select, textarea { min-height: 44px; font-size: 16px; }
      input[type="checkbox"], input[type="radio"] { flex: none; width: 20px; min-width: 20px; min-height: 20px; padding: 0; justify-self: start; }
      button, .button, .sm, .icon-button { min-height: 44px; }
      .icon-button { width: 44px; }
      .filter-row, .viewer-filter-row, .disposal-filter { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .master-row, .master-form, .set-add-grid { grid-template-columns: 1fr; }
      .snapshot-intro { grid-template-columns: 1fr; }
      .snapshot-context-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .snapshot-context-grid > div:nth-child(2) { border-right: 0; }
      .snapshot-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .snapshot-apply-row { flex-direction: column; align-items: stretch; }
      .viewer-result-table { overflow: visible; }
      .viewer-result-header { display: none; }
      .viewer-result-row,
      .viewer-result-table.is-selectable .viewer-result-row,
      .viewer-result-table.show-revision-date .viewer-result-row,
      .viewer-result-table.is-selectable.show-revision-date .viewer-result-row { position: relative; min-width: 0; grid-template-columns: 1fr; gap: 0; padding: var(--sp-3); border: 1px solid var(--line); border-radius: var(--r-lg); background: var(--surface); cursor: pointer; }
      .viewer-results-heading { align-items: stretch; flex-direction: column; }
      .viewer-result-tools { width: 100%; margin-left: 0; flex-wrap: wrap; justify-content: space-between; }
      .viewer-result-list { gap: var(--sp-3); border-top: 0; }
      .viewer-result-row > span { display: block; padding: 0; border: 0; }
      .viewer-result-row > span::before { content: none; }
      .viewer-result-row > .viewer-result-detail-only { display: none; }
      .viewer-result-row > .viewer-result-name { padding-right: var(--sp-4); }
      .viewer-result-row > .mono { margin-top: var(--sp-1); color: var(--gray-600); font-size: 12.5px; }
      .viewer-result-row.is-selectable { padding-right: calc(var(--sp-3) + 44px); }
      .viewer-result-row > .check-col { position: absolute; top: var(--sp-2); right: var(--sp-2); width: 44px; min-height: 44px; }
      .viewer-result-row .mono .viewer-result-value { min-width: 0; white-space: nowrap; overflow-wrap: normal; }
      .bulk-select-all-label { min-height: 44px; }
      .viewer-result-name a { display: -webkit-box; overflow: hidden; font-size: 14px; line-height: 1.45; white-space: normal; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
      .column-settings { display: none; }
      .doc-table-wrap { overflow: visible; }
      .doc-table, .doc-table tbody { display: block; width: 100%; }
      .doc-table thead { display: none; }
      .doc-table.is-bulk-selectable thead { display: block; }
      .doc-table.is-bulk-selectable thead tr { margin-bottom: var(--sp-2); }
      .doc-table.is-bulk-selectable thead th { display: none; }
      .doc-table.is-bulk-selectable thead .check-col { display: block; width: 100%; padding: 0; border: 0; background: transparent; }
      .doc-table.is-bulk-selectable .bulk-select-all-text { position: static; width: auto; height: auto; margin: 0; overflow: visible; clip: auto; white-space: normal; }
      .doc-table tbody { display: grid; gap: var(--sp-3); }
      .doc-table tr { display: block; padding: var(--sp-3); background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); }
      .doc-table tr.is-disposed { box-shadow: inset 3px 0 0 var(--gray-300); }
      .doc-table tr.is-disposed td:first-child { border-left: 0; }
      .doc-table td { display: grid; grid-template-columns: minmax(104px, 34%) minmax(0, 1fr); gap: var(--sp-3); width: 100%; padding: var(--sp-2) 0; border-bottom: 1px solid var(--gray-100); white-space: normal; }
      .doc-table td:last-child { border-bottom: 0; }
      .doc-table td::before { content: attr(data-label); color: var(--gray-500); font-size: 12px; font-weight: 600; }
      .doc-table .name-cell { padding-top: 0; }
      .doc-table .name-cell a { font-size: 14px; }
      .doc-table .check-col { width: 100%; grid-template-columns: minmax(104px, 34%) minmax(0, 1fr); }
      .doc-table .loc-cell-main, .doc-table .mono-cell { white-space: normal; }
      .metric-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .metric-card + .metric-card { border-left: 0; }
      .metric-card:nth-child(even) { border-left: 1px solid var(--line); }
      .metric-card:nth-child(n+3) { border-top: 1px solid var(--line); }
      .panel { padding: var(--sp-4); }
      .help-task-grid { grid-template-columns: 1fr; }
      .help-task-card { min-height: 64px; padding: var(--sp-3); }
      .floor-plan-scroll:not(.is-zoomed) .floor-rack .rack-num { display: none; }
      .floor-plan-layout > .floor-plan-side { order: -1; }
      .mobile-floor-plan-note { display: block; margin: 0 0 var(--sp-3); padding: var(--sp-3); border-radius: var(--r-md); background: var(--primary-soft); color: var(--primary); font-size: 12.5px; font-weight: 600; }
      .floor-plan-media [data-rack-select] { pointer-events: none; }
      .floor-plan-scroll.is-zoomed .floor-plan-media { min-width: 760px; }
      .floor-plan-tools { align-items: flex-start; }
      .zone-overview summary { min-height: 44px; }
      .zone-rack-links { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .zone-rack-links a { min-height: 44px; align-items: center; }
      .search-home { padding-top: var(--sp-4); }
      .modal, .modal.disposal-review-modal { width: calc(100vw - var(--sp-6)); max-width: calc(100vw - var(--sp-6)); overflow-x: clip; }
      .modal-body { min-width: 0; padding: var(--sp-4); }
      .modal-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .modal-actions > * { width: 100%; }
      .bulk-bar, .bulk-bar form { flex-direction: column; align-items: stretch; }
      .bulk-bar { left: var(--sp-3); right: var(--sp-3); }
      .app-shell:has(.bulk-bar:not([hidden])) { padding-bottom: calc(var(--sp-8) + 48px + 200px + env(safe-area-inset-bottom)); }
      .app-toast { width: calc(100vw - var(--sp-8)); max-width: none; text-align: center; }
    }
    @media (max-width: 520px) {
      .filter-row, .viewer-filter-row, .disposal-filter, .management-grid { grid-template-columns: 1fr; }
      .modal-actions { grid-template-columns: 1fr; }
      .page-head .button-group > *, .document-toolbar > * { flex-basis: 100%; }
      .doc-table td, .doc-table .check-col { grid-template-columns: 92px minmax(0, 1fr); }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { transition-duration: .01ms !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; }
    }`;
}
