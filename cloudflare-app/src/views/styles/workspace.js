// 공통 작업 화면과 네이티브 검색 표. 기존 색상·좌표 토큰을 그대로 사용한다.
export function workspaceStyles() {
  return `
    h1, .page-head h1, .document-title-copy h1 { font-size: var(--text-title); }
    h2, .section-title h2 { font-size: var(--text-section); }
    body { font-size: var(--text-body); }
    .page-head { align-items: center; gap: var(--sp-5); padding-block: var(--sp-3); margin-bottom: var(--sp-4); }
    .page-head > div { min-width: 0; }
    .button, button.primary, button.action-button, .danger-button { min-height: var(--control-height); }
    .button.sm, .danger-button.sm { min-height: var(--sp-8); }
    input:not([type="checkbox"]):not([type="radio"]), select { min-height: var(--control-height); }
    :is(a, button, input, select, textarea, summary):focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    :is(input, select, textarea, button, a, summary) { scroll-margin-block: 100px; }
    .search-workspace-head { display: grid; grid-template-columns: minmax(220px, 1fr) minmax(280px, 2fr); background: transparent; color: var(--ink); border: 0; padding: var(--sp-3) 0; }
    .search-workspace-head .viewer-search-form { width: 100%; }
    .viewer-filter-panel { padding: var(--sp-4); }
    .viewer-workspace { min-width: 0; }
    .viewer-workspace.has-preview { grid-template-columns: minmax(0, 1fr) var(--preview-width); }
    .viewer-workspace .results-panel { min-width: 0; padding: var(--sp-4); }
    .viewer-results-heading { margin-bottom: var(--sp-4); }
    .viewer-result-table { overflow-x: auto; }
    .viewer-result-table table { width: 100%; table-layout: fixed; }
    .viewer-result-table .viewer-result-header, .viewer-result-table .viewer-result-row { display: table-row; min-width: 0; cursor: auto; }
    .viewer-result-table .viewer-result-list { display: table-row-group; }
    .viewer-result-header th, .viewer-result-row td { padding: var(--sp-3); vertical-align: middle; overflow-wrap: anywhere; }
    .viewer-result-header th { font-size: var(--text-meta); font-weight: 600; white-space: normal; }
    .viewer-result-header th:nth-last-child(4) { width: 30%; }
    .viewer-result-header th:nth-last-child(3) { width: 15%; }
    .viewer-result-header th:last-child { width: 104px; }
    .viewer-result-table .check-col { display: table-cell; width: 56px; padding: 0 var(--sp-1); }
    .viewer-result-name a { display: block; color: var(--ink); font-size: var(--text-body); font-weight: 600; text-decoration: none; white-space: normal; overflow-wrap: anywhere; }
    .viewer-result-name a:hover { color: var(--primary); text-decoration: underline; }
    .viewer-result-identity { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-top: var(--sp-1); color: var(--muted); font-size: var(--text-meta); }
    .viewer-result-identity small { font: inherit; white-space: nowrap; }
    .viewer-result-location { color: var(--primary); font-weight: 600; font-size: var(--text-body); word-break: keep-all; }
    .viewer-result-category { color: var(--muted); }
    .viewer-result-action .button { white-space: nowrap; }
    .viewer-workspace .viewer-preview { width: min(480px, calc(100% - var(--sp-8))); max-height: calc(100dvh - var(--sp-8)); padding: var(--sp-5); border: 1px solid var(--line); border-radius: var(--r-lg); background: var(--surface); color: var(--ink); overflow-y: auto; }
    .viewer-workspace .viewer-preview:not([open]) { display: none; }
    .viewer-workspace .viewer-preview[open] { display: grid; gap: var(--sp-3); position: fixed; inset: 0; margin: auto; box-shadow: var(--shadow-2); }
    .viewer-workspace .viewer-preview.is-inline[open] { position: sticky; top: var(--sp-5); inset-inline: auto; width: 100%; margin: 0; box-shadow: none; }
    .viewer-preview::backdrop { background: var(--scrim); }
    .viewer-preview p { margin: 0; }
    .preview-location { display: grid; gap: var(--sp-2); padding: var(--sp-4); border-radius: var(--r-md); background: var(--primary-soft); }
    .preview-location strong { color: var(--primary); font-size: var(--text-section); word-break: keep-all; }
    .preview-rack { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: var(--sp-1); }
    .preview-slot { display: grid; place-items: center; min-height: var(--sp-8); border: 1px solid var(--line); border-radius: var(--r-sm); color: var(--muted); font-size: 11px; }
    .preview-slot.is-active { background: var(--action); color: var(--action-ink); border-color: var(--action-strong); font-weight: 700; }
    .document-detail-head { padding-bottom: var(--sp-4); border-bottom: 1px solid var(--line); }
    .document-detail-head .detail-actions { padding: 0; margin-top: var(--sp-4); border: 0; }
    .document-detail-head .detail-action-groups { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--sp-3); }
    .document-detail-head .detail-action-groups > div { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2); }
    .detail-state-label { display: none; }
    .document-state-summary, .historical-location { margin-block: var(--sp-4); }
    .historical-location > summary { cursor: pointer; font-weight: 600; }
    .historical-location .document-location-summary { margin-top: var(--sp-4); border-left-color: var(--gray-300); }
    .historical-location .document-location-summary strong { color: var(--gray-700); }
    .document-state-summary dl, .disposal-target-summary { display: grid; gap: var(--sp-3); }
    .disposal-target-summary > div { display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: var(--sp-3); }
    .disposal-target-summary dt { color: var(--muted); }
    .disposal-target-summary dd { margin: 0; overflow-wrap: anywhere; }
    .document-form, .document-form .form-section { min-width: 0; }
    .revision-confirm { width: auto; min-width: 0; }
    .revision-source-summary dd, .revision-confirm span { overflow-wrap: anywhere; }
    .document-form .form-section { padding-block: var(--sp-4); }
    .continuation-options { padding: var(--sp-4); background: var(--gray-50); border: 1px solid var(--line); border-radius: var(--r-md); }
    .continuation-options .check-item { display: inline-flex; margin-right: var(--sp-4); }
    .continuation-options p { margin-bottom: 0; }
    .revision-change-summary { display: flex; flex-wrap: wrap; gap: var(--sp-3); align-items: center; padding: var(--sp-4); background: var(--primary-soft); border-radius: var(--r-md); }
    .revision-change-summary span { flex-basis: 100%; color: var(--muted); }
    [data-save-feedback] a, [data-save-feedback] button { display: inline-flex; margin: var(--sp-2) var(--sp-3) var(--sp-1) 0; }
    .snapshot-help summary { cursor: pointer; font-weight: 600; }
    @media (max-width: 1099px) { .search-workspace-head { grid-template-columns: 1fr; } }
    @media (max-width: 760px) {
      .page-head { gap: var(--sp-3); }
      .button, button.primary, button.action-button, .danger-button, .button.sm, .icon-button { min-height: var(--touch-height); }
      .viewer-results-heading { align-items: center; gap: var(--sp-2); }
      .viewer-result-tools { flex-wrap: wrap; }
      .viewer-workspace .results-panel { padding: var(--sp-3); }
      .viewer-result-table { overflow: visible; }
      .viewer-result-table table, .viewer-result-table .viewer-result-list { display: block; }
      .viewer-result-table thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
      .viewer-result-table .viewer-result-row { position: relative; display: flex; flex-wrap: wrap; gap: var(--sp-2); padding: var(--sp-4) 0; border-bottom: 1px solid var(--line); }
      .viewer-result-row td { display: block; padding: 0; border: 0; width: 100%; }
      .viewer-result-row .viewer-result-name { padding-right: 0; }
      .viewer-result-table.is-selectable .viewer-result-name { padding-right: 52px; }
      .viewer-result-row .viewer-result-location { width: 100%; }
      .viewer-result-row .viewer-result-category { width: auto; flex: 1; align-self: center; font-size: var(--text-meta); }
      .viewer-result-row .viewer-result-action { width: auto; }
      .viewer-result-table .viewer-result-row .check-col { position: absolute; right: 0; top: var(--sp-3); width: var(--touch-height); }
      .viewer-result-name a { display: block; overflow: visible; -webkit-line-clamp: unset; }
      .viewer-result-identity { white-space: normal; }
      .viewer-workspace .viewer-preview[open] { width: 100%; max-width: 100%; height: 100dvh; border: 0; max-height: 100dvh; border-radius: 0; padding: var(--sp-5); align-content: start; }
      .column-settings { display: none; }
      .sticky-save-bar .button-group { flex-wrap: wrap; }
      .document-form .form-actions { gap: var(--sp-3); }
      .document-detail-head .detail-action-groups { display: grid; }
      .disposal-target-summary > div { grid-template-columns: 72px minmax(0, 1fr); }
      .continuation-options .check-item { min-height: var(--touch-height); }
    }
    @media print { .viewer-preview, .viewer-result-action, .detail-actions, .continuation-options { display: none !important; } }`;
}
