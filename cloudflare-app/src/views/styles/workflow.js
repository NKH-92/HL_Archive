// 전역 CSS의 업무 흐름과 상세 화면 조각. 순서는 styles.js에서 고정한다.

export function workflowStyles() {
  return `    .bulk-bar { position: fixed; inset: auto var(--sp-4) var(--sp-4); z-index: 40; display: flex; align-items: center; gap: var(--sp-3); max-height: min(50vh, 360px); overflow-y: auto; padding: var(--sp-2) var(--sp-3); background: var(--gray-900); color: var(--surface); border-radius: var(--r-lg); box-shadow: var(--shadow-2); font-size: 13px; }
    .bulk-bar[hidden] { display: none; }
    .app-shell:has(.bulk-bar:not([hidden])) { padding-bottom: calc(var(--sp-8) + 80px); }
    .bulk-limit-notice { color: var(--action); font-weight: 600; }
    .bulk-limit-notice[hidden] { display: none; }
    .bulk-bar form { display: flex; flex: 1; flex-wrap: wrap; gap: var(--sp-2); min-width: 0; }
    .bulk-bar input { background: rgba(255, 255, 255, .12); color: var(--surface); border-color: transparent; min-height: 32px; }
    .bulk-bar input::placeholder { color: rgba(255, 255, 255, .55); }
    .bulk-bar input:focus { background: rgba(255, 255, 255, .18); border-color: rgba(255, 255, 255, .4); box-shadow: none; }
    .pagination { display: flex; justify-content: center; align-items: center; gap: var(--sp-3); margin-top: var(--sp-4); color: var(--gray-600); font-weight: 600; font-size: 12.5px; }
    .workspace-tabs { display: flex; gap: var(--sp-1); border-bottom: 1px solid var(--line); }
    .workspace-tabs a { padding: var(--sp-3) var(--sp-4); border-bottom: 2px solid transparent; color: var(--gray-500); text-decoration: none; font-size: 13.5px; font-weight: 700; }
    .workspace-tabs a[aria-current="page"] { border-color: var(--primary); color: var(--primary); }
    .disposal-filter { grid-template-columns: minmax(220px, 1fr) repeat(3, minmax(140px, auto)) auto auto; }
    .periodic-disposal-filter { grid-template-columns: repeat(2, minmax(180px, 1fr)) auto auto; align-items: end; }
    .modal.disposal-review-modal { width: min(560px, calc(100vw - var(--sp-8))); }
    .disposal-count-confirmation { margin: 0; padding: var(--sp-4); border: 1px solid var(--danger); border-radius: var(--r-md); background: var(--danger-soft); text-align: center; }
    .disposal-count-confirmation strong { display: block; margin-top: var(--sp-1); color: var(--danger); font-size: 24px; line-height: 1.2; }
    .disposal-review-list { max-height: 220px; overflow-y: auto; margin: 0; padding: var(--sp-3) var(--sp-3) var(--sp-3) var(--sp-6); border: 1px solid var(--line); border-radius: var(--r-md); background: var(--gray-50); }
    .disposal-review-list li { min-width: 0; padding: var(--sp-1) 0; overflow-wrap: anywhere; font-size: 13px; }
    .disposal-safety-panel { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--sp-4); border-color: var(--danger); background: var(--danger-soft); }
    .disposal-safety-panel p { margin: var(--sp-1) 0 0; color: var(--gray-700); }
    /* 폐기 경고 배지는 좁은 폭에서도 줄바꿈 없이 한 덩어리로 읽혀야 한다. */
    .disposal-safety-panel > .status { flex: none; white-space: nowrap; }
    .disposal-history-table small { display: block; margin-top: var(--sp-1); color: var(--gray-500); white-space: nowrap; }
    .results-panel .doc-table td small { display: block; margin-top: var(--sp-1); color: var(--gray-500); white-space: nowrap; }
    .disposal-complete { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--sp-3); }
    .disposal-complete-actions { display: flex; flex-wrap: wrap; gap: var(--sp-2); }

    .document-form-layout { display: grid; grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr); gap: var(--sp-4); align-items: start; }
    .document-form { display: grid; gap: var(--sp-4); padding: var(--sp-5); }
    .form-section { display: grid; gap: var(--sp-3); min-width: 0; margin: 0; padding: 0 0 var(--sp-4); border: 0; border-bottom: 1px solid var(--line); }
    .form-section:last-of-type { border-bottom: 0; }
    .form-section > legend, .form-section > h2 { margin: 0 0 var(--sp-1); padding: 0; font-size: 15px; font-weight: 700; }
    .form-grid { display: grid; gap: var(--sp-3); }
    .form-grid.two-column { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .field-group { display: grid; gap: var(--sp-1); min-width: 0; }
    .mono-input { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
    .field-error { margin: 0; color: var(--danger); font-size: 12.5px; font-weight: 600; }
    .form-error-summary { padding: var(--sp-4); border: 1px solid var(--danger); border-radius: var(--r-md); background: var(--danger-soft); color: var(--danger); }
    .form-error-summary p { margin: var(--sp-1) 0; }
    .form-error-summary ul { margin: var(--sp-2) 0 0; padding-left: var(--sp-5); }
    .form-error-summary a { color: inherit; font-weight: 600; }
    .duplicate-notice { padding: var(--sp-4); border: 1px solid var(--warning); border-radius: var(--r-md); background: var(--warning-soft); color: var(--gray-900); }
    .duplicate-notice[hidden] { display: none; }
    .duplicate-notice p { margin: var(--sp-2) 0; color: var(--gray-700); }
    .location-picker-steps { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: var(--sp-2); }
    .location-picker-steps label { gap: var(--sp-1); }
    .location-picker-steps label > span { color: var(--gray-600); font-size: 12px; font-weight: 600; }
    .enhanced-control-hidden { display: none !important; }
    .form-actions { display: flex; justify-content: space-between; gap: var(--sp-2); }
    .sticky-save-bar { position: sticky; bottom: var(--sp-3); z-index: 15; align-items: center; padding: var(--sp-3); border: 1px solid var(--line); border-radius: var(--r-lg); background: var(--surface); box-shadow: var(--shadow-2); }
    .form-completion { display: grid; gap: var(--sp-1); min-width: 150px; color: var(--gray-700); font-size: 12px; }
    .form-completion progress { appearance: none; display: block; width: 100%; height: 5px; overflow: hidden; border: 0; border-radius: 999px; background: var(--gray-100); }
    .form-completion progress::-webkit-progress-bar { background: var(--gray-100); }
    .form-completion progress::-webkit-progress-value { background: var(--primary); transition: inline-size .18s ease; }
    .form-completion progress::-moz-progress-bar { background: var(--primary); }
    .tag-picker { display: grid; gap: var(--sp-2); }
    .tag-picker > .muted { margin: 0; font-size: 12px; }
    .tag-search { max-width: 360px; }
    .form-tags [hidden] { display: none; }
    .location-selection-preview { display: grid; grid-template-columns: minmax(0, 2fr) minmax(90px, .6fr) auto; gap: var(--sp-3); align-items: center; padding: var(--sp-3); border: 1px solid var(--line); border-radius: var(--r-md); background: var(--gray-50); }
    .location-selection-preview div { display: grid; gap: 2px; }
    .location-selection-preview span { color: var(--gray-500); font-size: 11.5px; font-weight: 600; }
    .location-selection-preview strong { font-size: 13px; }
    .form-review { position: sticky; top: var(--sp-4); padding: var(--sp-5); }
    .form-review summary { cursor: pointer; list-style: none; font-size: 15px; font-weight: 700; }
    .form-review summary::-webkit-details-marker { display: none; }
    .form-review summary::after { content: "+"; float: right; color: var(--gray-500); }
    .form-review[open] summary::after { content: "−"; }
    .form-review dl { display: grid; gap: 0; margin: var(--sp-4) 0 0; }
    .form-review dl div { display: grid; grid-template-columns: minmax(96px, 1fr) minmax(0, 2fr); gap: var(--sp-3); padding: var(--sp-2) 0; border-bottom: 1px solid var(--gray-100); }
    .form-review dt { color: var(--gray-500); font-size: 12px; font-weight: 600; }
    .form-review dd { margin: 0; font-size: 13px; font-weight: 600; overflow-wrap: anywhere; }

    .check-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--sp-2); border-radius: var(--r-md); padding: var(--sp-3); background: var(--gray-50); border: 0; }
    .check-item, .check-inline { display: inline-flex; align-items: center; gap: var(--sp-2); width: max-content; font-weight: 500; font-size: 13px; color: var(--ink); }
    .check-item input, .check-inline input { width: auto; min-height: auto; accent-color: var(--primary); }
    .master-list { display: grid; gap: var(--sp-2); }
    .master-row, .master-form { display: grid; grid-template-columns: minmax(140px, 1fr) minmax(140px, 1fr) auto auto; gap: var(--sp-2); align-items: center; }
    .master-page-head { align-items: center; }
    .master-page-head > div:first-child { max-width: 760px; }
    .master-page-head h1 { margin-bottom: var(--sp-1); }
    .master-page-head p, .master-section-title p, .master-list-heading p { margin: 0; color: var(--gray-500); font-size: 12.5px; }
    .master-head-guide { display: grid; flex: 0 1 360px; gap: var(--sp-1); padding: var(--sp-3) var(--sp-4); border-left: 3px solid var(--primary); background: var(--surface); }
    .master-head-guide strong { font-size: 12px; color: var(--gray-600); }
    .master-head-guide span { color: var(--gray-800); font-size: 13px; font-weight: 600; }
    .master-create-panel, .master-management { max-width: 1120px; margin-inline: auto; }
    .master-section-title { align-items: flex-start; }
    .master-section-title h2, .master-list-heading h2 { margin: 0 0 var(--sp-1); }
    .master-create-form { display: grid; grid-template-columns: minmax(180px, 1fr) minmax(260px, 2fr) auto; gap: var(--sp-3); align-items: end; }
    .master-create-form label, .category-master-edit-form label, .master-search-field { display: grid; gap: var(--sp-1); min-width: 0; }
    .master-create-form label > span, .category-master-edit-form label > span, .master-search-field > span { color: var(--gray-600); font-size: 12px; font-weight: 600; }
    .master-create-form label small, .category-master-edit-form label small { color: var(--gray-500); font-size: 11.5px; font-weight: 500; }
    .master-list-heading { display: flex; justify-content: space-between; align-items: end; gap: var(--sp-5); padding-bottom: var(--sp-4); border-bottom: 1px solid var(--line); }
    .master-list-tools { display: grid; grid-template-columns: minmax(220px, 320px) auto; align-items: end; gap: var(--sp-3); }
    .master-inactive-toggle { display: inline-flex; align-items: center; gap: var(--sp-2); min-height: 36px; color: var(--gray-700); font-size: 12.5px; font-weight: 600; white-space: nowrap; }
    .master-inactive-toggle input { width: auto; min-height: auto; accent-color: var(--primary); }
    .category-master-list { display: grid; margin-top: var(--sp-2); }
    .category-master-item { border-bottom: 1px solid var(--line); }
    .category-master-item:last-child { border-bottom: 0; }
    .category-master-summary { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: var(--sp-3); min-height: 56px; padding: var(--sp-2) var(--sp-3); cursor: pointer; list-style: none; }
    .category-master-summary::-webkit-details-marker { display: none; }
    .category-master-summary:hover { background: var(--gray-50); }
    .category-master-summary:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; border-radius: var(--r-sm); }
    .category-master-copy { display: grid; min-width: 0; gap: var(--sp-1); }
    .category-master-copy strong, .category-master-copy small { overflow-wrap: anywhere; }
    .category-master-copy strong { font-size: 13.5px; }
    .category-master-copy small { color: var(--gray-500); font-size: 12px; font-weight: 500; }
    .category-master-toggle { display: inline-flex; align-items: center; gap: var(--sp-1); color: var(--primary); font-size: 12.5px; font-weight: 700; }
    .category-master-toggle::after { content: "▾"; color: var(--gray-400); }
    .category-master-item[open] .category-master-toggle::after { content: "▴"; }
    .category-master-edit { display: grid; gap: var(--sp-4); padding: var(--sp-4); border-top: 1px solid var(--line); background: var(--gray-50); }
    .category-master-edit-form { display: grid; grid-template-columns: minmax(180px, 1fr) minmax(260px, 2fr) auto; align-items: end; gap: var(--sp-3); }
    .category-master-state-action { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-4); padding-top: var(--sp-3); border-top: 1px solid var(--line); }
    .category-master-state-action p { margin: 0; color: var(--gray-600); font-size: 12.5px; }
    .master-filter-empty { margin-top: var(--sp-4); }
    .master-filter-empty small { color: var(--gray-500); }

    .manual-list { margin: 0; padding: 0; list-style: none; display: grid; gap: var(--sp-3); }
    .manual-list li { display: grid; gap: var(--sp-1); padding-bottom: var(--sp-3); border-bottom: 1px solid var(--gray-100); }
    .manual-list li:last-child { border-bottom: 0; padding-bottom: 0; }
    .manual-list strong { font-size: 13.5px; }
    .manual-list span { color: var(--gray-500); font-size: 12.5px; }
    .help-task-panel { display: grid; gap: var(--sp-4); }
    .help-task-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sp-3); }
    .help-task-card { display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; gap: var(--sp-3); align-items: center; min-width: 0; min-height: 72px; padding: var(--sp-3) var(--sp-4); border: 1px solid var(--line); border-radius: var(--r-md); color: var(--gray-800); text-decoration: none; transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease; }
    .help-task-card > i:first-child { display: grid; place-items: center; width: 36px; height: 36px; border-radius: var(--r-sm); background: var(--primary-soft); color: var(--primary); }
    .help-task-arrow { color: var(--gray-400); font-size: 20px; line-height: 1; }
    .help-task-card strong, .help-task-card small { display: block; }
    .help-task-card small { margin-top: var(--sp-1); color: var(--gray-500); font-size: 12px; line-height: 1.45; }
    .help-task-card:hover { border-color: var(--primary); box-shadow: var(--shadow-1); transform: translateY(-1px); }
    .help-task-card:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .contact-list { margin: 0; display: grid; gap: var(--sp-2); }
    .contact-list div { display: flex; justify-content: space-between; gap: var(--sp-3); }
    .contact-list dt { color: var(--gray-500); font-size: 12.5px; font-weight: 600; }
    .contact-list dd { margin: 0; font-size: 13px; font-weight: 600; }

    .modal { max-width: calc(100vw - var(--sp-8)); max-height: calc(100dvh - var(--sp-6)); overflow-x: clip; overflow-y: auto; border: 0; border-radius: var(--r-lg); padding: 0; width: min(440px, calc(100vw - var(--sp-8))); box-shadow: var(--shadow-2); }
    .modal::backdrop { background: var(--scrim); }
    .modal-body { min-width: 0; max-width: 100%; padding: var(--sp-5); display: grid; gap: var(--sp-4); }
    .modal-body > * { min-width: 0; }
    .modal-actions { display: flex; justify-content: flex-end; gap: var(--sp-2); }
    .command-palette { width: min(520px, calc(100% - var(--sp-8))); max-height: min(640px, calc(100vh - var(--sp-8))); padding: var(--sp-4); border: 0; border-radius: var(--r-lg); box-shadow: var(--shadow-2); }
    .command-palette::backdrop { background: var(--scrim); }
    .command-palette-head { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); margin-bottom: var(--sp-3); }
    .command-palette-list { display: grid; gap: var(--sp-1); max-height: 420px; overflow-y: auto; margin-top: var(--sp-3); }
    .command-palette-list a { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3); border-radius: var(--r-md); color: var(--gray-700); text-decoration: none; font-weight: 600; }
    .command-palette-list a:hover, .command-palette-list a:focus, .command-palette-list a.is-active { background: var(--primary-soft); color: var(--primary); outline: 0; }
    .command-palette-list a[hidden] { display: none; }
    .command-palette > .muted { margin: var(--sp-3) 0 0; }
    .danger-text { color: var(--danger); font-size: 13px; margin: 0; }

    .app-toast { position: fixed; left: 50%; bottom: var(--sp-6); transform: translate(-50%, var(--sp-3)); z-index: 200; display: flex; align-items: center; gap: var(--sp-3); max-width: min(90vw, 520px); padding: var(--sp-3) var(--sp-4); border-radius: var(--r-md); background: var(--gray-800); color: var(--surface); font-weight: 600; font-size: 13px; box-shadow: var(--shadow-2); opacity: 0; transition: opacity .2s ease, transform .2s ease; pointer-events: auto; }
    .app-toast.is-visible { opacity: 1; transform: translate(-50%, 0); }
    .app-toast.is-error { background: var(--danger); }
    .app-toast .icon-button { flex: none; color: inherit; border-color: rgba(255, 255, 255, .4); }
    .app-confirm-dialog { width: min(92vw, 480px); padding: 0; border: 1px solid var(--line); border-radius: var(--r-lg); color: var(--gray-900); box-shadow: var(--shadow-2); }
    .app-confirm-dialog::backdrop { background: var(--scrim); }

    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
    .print-only { display: none; }

    .set-doc-table td strong { white-space: nowrap; font-size: 12.5px; font-weight: 600; color: var(--primary); }
    .set-doc-table tr.is-disposed td:first-child { border-left: 3px solid var(--gray-300); }
    .set-add-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sp-5); }
    .set-candidate-list { display: grid; gap: var(--sp-2); }
    .set-candidate { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-3); border-radius: var(--r-md); padding: var(--sp-2) var(--sp-3); background: var(--gray-50); font-size: 13px; }
    .set-candidate > input { flex: none; width: auto; min-height: auto; accent-color: var(--primary); }
    .set-candidate > span:nth-child(2) { flex: 1; min-width: 0; }
    .set-candidate small { display: block; color: var(--gray-500); font-size: 12px; }
    .set-candidate.is-disposed { box-shadow: inset 3px 0 0 var(--gray-300); }
    .set-danger-row { margin-top: var(--sp-5); display: flex; justify-content: flex-end; }
    .missing-document-links { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-top: var(--sp-2); }
    .missing-document-links a { color: var(--primary); font-weight: 700; }
    .lock-form { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: var(--sp-3); }
    .set-list-filters { grid-template-columns: minmax(220px, 1fr) repeat(2, minmax(150px, auto)) auto auto; }

    .rack-face-tabs { display: flex; gap: var(--sp-2); margin-bottom: var(--sp-4); }
    .rack-face-tabs a { padding: var(--sp-2) var(--sp-4); border: 1px solid var(--line); border-radius: var(--r-md); color: var(--gray-600); font-weight: 700; text-decoration: none; }
    .rack-face-tabs a.active { border-color: var(--primary); background: var(--primary-soft); color: var(--primary); }
    .rack-column-guide { min-width: 700px; display: flex; justify-content: space-between; gap: var(--sp-3); margin-bottom: var(--sp-2); color: var(--gray-500); font-size: 12px; }
    .rack-column-guide strong { color: var(--gray-700); }
    .rack-grid-scroll { overflow-x: auto; padding-bottom: var(--sp-2); outline-offset: 2px; }
    .rack-digital-grid { --cols: 7; min-width: 700px; display: grid; grid-template-columns: repeat(var(--cols), minmax(88px, 1fr)); gap: var(--sp-2); }
    .rack-cell { min-height: 76px; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--surface); overflow: hidden; }
    .rack-cell > a:first-child { min-height: 54px; display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); padding: var(--sp-2) var(--sp-3); color: var(--ink); text-decoration: none; }
    .rack-cell > a:first-child:hover, .rack-cell > a:first-child:focus-visible { background: var(--primary-soft); color: var(--primary); }
    .rack-cell span { font-size: 11px; color: var(--gray-500); }
    .rack-cell strong { font-size: 17px; color: var(--primary); }
    .rack-cell.is-empty { background: var(--gray-50); opacity: .72; }
    .rack-cell.is-selected { border-color: var(--primary); box-shadow: inset 0 0 0 1px var(--primary); background: var(--primary-soft); opacity: 1; }
    .rack-cell-disposed { display: block; padding: 2px var(--sp-3); border-top: 1px solid var(--line); color: var(--gray-500); font-size: 11px; text-decoration: none; }

    .snapshot-intro { display: grid; grid-template-columns: minmax(170px, .35fr) minmax(0, 1fr); gap: var(--sp-6); align-items: start; }
    .snapshot-context-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--sp-3); }
    .snapshot-context-grid > div { display: grid; gap: var(--sp-1); padding-right: var(--sp-3); border-right: 1px solid var(--line); }
    .snapshot-context-grid > div:last-child { border-right: 0; }
    .snapshot-context-grid span, .snapshot-context-grid small { color: var(--gray-500); font-size: 12px; }
    .snapshot-context-grid strong { font-size: 15px; }
    .snapshot-file-summary { padding: var(--sp-3); border: 1px solid var(--line); border-radius: var(--r-md); background: var(--gray-50); font-size: 13px; font-weight: 700; }
    .snapshot-progress { appearance: none; display: block; width: 100%; height: 8px; overflow: hidden; border: 0; border-radius: 999px; background: var(--gray-100); }
    .snapshot-progress::-webkit-progress-bar { background: var(--gray-100); }
    .snapshot-progress::-webkit-progress-value { background: var(--primary); transition: inline-size .2s ease; }
    .snapshot-progress::-moz-progress-bar { background: var(--primary); }
    .snapshot-rules { margin: 0; padding-left: var(--sp-5); display: grid; gap: var(--sp-2); color: var(--gray-600); font-size: 13px; }
    .snapshot-metrics { grid-template-columns: repeat(5, minmax(0, 1fr)); }
    .snapshot-apply-row { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-4); margin-top: var(--sp-5); padding-top: var(--sp-4); border-top: 1px solid var(--line); }
    .snapshot-apply-row p { margin: var(--sp-1) 0 0; }

    .movement-preview { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: var(--sp-3); padding: var(--sp-4); border: 1px solid var(--line); border-radius: var(--r-md); background: var(--gray-50); }
    .movement-preview strong { color: var(--primary); }
    .movement-preview span:last-child { color: var(--primary); font-weight: 700; }
    .movement-history td strong { color: var(--primary); }
    .movement-filter { align-items: end; }
    .quality-strip a.warn { color: inherit; text-decoration: none; }
    .quality-issue-nav { display: flex; flex-wrap: wrap; gap: var(--sp-2); margin-bottom: var(--sp-4); }
    .search-index-health { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-4); }
    .search-index-health div { display: grid; gap: var(--sp-1); }
    .search-index-health span, .search-index-health p { color: var(--gray-500); margin: 0; }
    .search-index-health.warning { border-color: var(--warning); }
    .search-index-health.review { border-color: var(--danger); }

    mark { background: var(--primary-soft); color: var(--primary); border-radius: 2px; padding: 0; font-weight: inherit; }
`;
}
