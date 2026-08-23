// Tectra-inspired 운영 셸과 화면별 정보 위계. 기존 컴포넌트 스타일 뒤에서 의도적으로 보강한다.

export function experienceStyles() {
  return `    .action-button,
    button.action-button,
    .button.action-button { background: var(--action); border-color: var(--action); color: var(--action-ink); }
    .action-button:hover,
    button.action-button:hover,
    .button.action-button:hover { background: var(--action-strong); border-color: var(--action-strong); color: var(--action-ink); }

    .search-workspace-head { display: grid; grid-template-columns: minmax(220px, .8fr) minmax(440px, 1.4fr); align-items: end; }
    .search-workspace-head .viewer-search-form { min-width: 0; }
    .search-results-controls { margin-top: calc(-1 * var(--sp-2)); }
    .mobile-search-filter-button { display: none; }
    .mobile-filter-dialog { width: min(520px, calc(100% - var(--sp-8))); padding: 0; border: 1px solid var(--line); border-radius: var(--r-lg); color: var(--gray-900); background: var(--surface); box-shadow: var(--shadow-2); }
    .mobile-filter-dialog::backdrop { background: var(--scrim); }
    .mobile-filter-form { display: grid; gap: var(--sp-4); padding: var(--sp-5); }
    .mobile-filter-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--sp-3); }
    .mobile-filter-head h2 { margin: var(--sp-1) 0 0; }
    .mobile-filter-head small { color: var(--gray-500); font-weight: 700; }
    .mobile-filter-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sp-2); }
    .mobile-filter-actions > * { justify-content: center; }

    .document-detail-head { position: relative; overflow: hidden; display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--sp-5); align-items: end; padding: var(--sp-8); margin-bottom: var(--sp-3); border-radius: var(--r-lg); background: var(--hero-bg); color: var(--surface); }
    .document-detail-head::after { content: ""; position: absolute; inset: 0; background-image: linear-gradient(rgba(255, 255, 255, .05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, .05) 1px, transparent 1px); background-size: var(--sp-8) var(--sp-8); pointer-events: none; }
    .document-detail-head > * { position: relative; z-index: 1; }
    .document-detail-head .breadcrumb { color: rgba(255, 255, 255, .6); }
    .document-detail-head .document-title-row { align-self: end; }
    .document-detail-head .document-title-row h1 { color: var(--surface); font-size: 26px; }
    .document-detail-head .document-title-row p { color: rgba(255, 255, 255, .82); }
    .document-location-visuals { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: stretch; }
    .minimap-card { background: var(--primary-deep); border-color: var(--primary-deep); color: var(--surface); }
    .minimap-card .section-title h2, .minimap-card .mini-column-guide strong { color: var(--surface); }
    .minimap-card .count-badge, .minimap-card .mini-column-guide strong { background: rgba(255, 255, 255, .12); color: var(--surface); }
    .minimap-card .mini-column-guide, .minimap-card .mini-axis, .minimap-card .mini-orientation-note { color: rgba(255, 255, 255, .6); }
    .minimap-card .mini-slot { background: rgba(255, 255, 255, .12); border-color: rgba(255, 255, 255, .18); color: rgba(255, 255, 255, .82); }
    .minimap-card .mini-slot.active { background: var(--action); border-color: var(--action); color: var(--action-ink); box-shadow: 0 0 0 3px var(--action-soft); }
    .minimap-card .mini-compass { background: var(--action-soft); color: var(--action-ink); }

    .floor-plan-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(220px, .28fr); gap: var(--sp-4); align-items: start; }
    .floor-plan-layout > .panel { margin: 0; }
    .zone-overview { display: grid; gap: var(--sp-1); }
    .zone-overview a { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); padding: var(--sp-3) 0; border-bottom: 1px solid var(--gray-100); color: var(--gray-700); text-decoration: none; }
    .zone-overview a:last-child { border-bottom: 0; }
    .zone-overview a:hover { color: var(--primary); }
    .zone-overview small { display: block; color: var(--gray-500); }
    .floor-rack:focus-visible, .floor-rack:hover { border-color: var(--action); box-shadow: 0 0 0 3px var(--action-soft); }
    .floor-rack.is-hit { background: var(--action); border-color: var(--action); color: var(--action-ink); }

    .snapshot-upload-panel { grid-template-columns: minmax(0, 1fr); scroll-margin-top: var(--sp-4); }
    .workflow-stepper { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0; margin-bottom: var(--sp-4); padding: var(--sp-4) var(--sp-5); border: 1px solid var(--line); border-radius: var(--r-lg); background: var(--surface); }
    .workflow-step { position: relative; display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: var(--sp-2); align-items: center; min-width: 0; }
    .workflow-step:not(:last-child)::after { content: ""; position: absolute; top: 14px; left: 38px; right: var(--sp-2); height: 1px; background: var(--line); }
    .workflow-step-index { position: relative; z-index: 1; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 999px; background: var(--gray-100); color: var(--gray-500); font-size: 12px; font-weight: 800; }
    .workflow-step strong { display: block; font-size: 12.5px; }
    .workflow-step small { display: block; color: var(--gray-500); font-size: 11.5px; }
    .workflow-step.is-complete .workflow-step-index { background: var(--success-soft); color: var(--success); }
    .workflow-step.is-current .workflow-step-index { background: var(--action); color: var(--action-ink); box-shadow: 0 0 0 3px var(--action-soft); }
    .workflow-step.is-current strong { color: var(--gray-900); }
    .workflow-current-step { display: none; }
    .snapshot-intro { border-top: 3px solid var(--primary); }
    .snapshot-apply-form { margin-top: var(--sp-4); padding: var(--sp-4); border: 1px solid var(--line); border-radius: var(--r-lg); background: var(--gray-50); }
    .snapshot-final-apply { border-top: 3px solid var(--action); }
    .snapshot-bootstrap-confirm { padding: var(--sp-4); border: 1px solid var(--warning); border-radius: var(--r-md); background: var(--warning-soft); }
    .permission-current, .permission-diff { display: grid; gap: var(--sp-1); padding: var(--sp-3); border: 1px solid var(--line); border-radius: var(--r-md); background: var(--gray-50); }
    .permission-current span, .permission-diff p { margin: 0; color: var(--gray-600); }
    .permission-added { color: var(--success) !important; }
    .permission-removed { color: var(--danger) !important; }
    .login-help { display: grid; gap: var(--sp-1); margin-top: var(--sp-4); padding-top: var(--sp-4); border-top: 1px solid var(--line); font-size: 12.5px; }
    .login-help p { margin: 0; }
    .mobile-filter-toggle { display: none; margin-bottom: var(--sp-2); }
    .disposal-review-actions { display: grid; gap: var(--sp-3); margin-top: var(--sp-4); }
    .disposal-review-actions > form { padding: var(--sp-3); border: 1px solid var(--line); border-radius: var(--r-md); }

    .disposal-shell { display: grid; gap: var(--sp-4); }
    .bulk-bar { border: 1px solid rgba(255, 255, 255, .18); }

    .admin-status-panel { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-5); border-left: 4px solid var(--success); background: var(--success-soft); }
    .admin-status-panel.is-attention { border-left-color: var(--warning); background: var(--warning-soft); }
    .admin-status-copy { display: grid; gap: var(--sp-2); }
    .admin-status-copy h2, .admin-status-copy p { margin: 0; }
    .admin-status-copy .action-button { justify-self: start; margin-top: var(--sp-1); }
    .admin-status-count { min-width: 112px; padding-left: var(--sp-4); border-left: 1px solid var(--line); text-align: center; }
    .admin-status-count strong { display: block; color: var(--gray-900); font-size: 28px; line-height: 1.2; }
    .admin-status-count span { color: var(--gray-600); font-size: 12px; font-weight: 600; }
    .management-section { padding: 0; overflow: hidden; }
    .management-heading { padding: var(--sp-4) var(--sp-5); border-bottom: 1px solid var(--line); }
    .management-heading p { margin: var(--sp-1) 0 0; }
    .management-links { gap: 0; }
    .management-links .admin-tile { margin: 0; border: 0; border-radius: 0; border-bottom: 1px solid var(--gray-100); }
    .management-links .admin-tile:last-child { border-bottom: 0; }

    .locked-field { display: grid; align-content: center; gap: var(--sp-1); padding: var(--sp-3); border: 1px solid var(--line); border-radius: var(--r-md); background: var(--gray-50); }
    .locked-field > span { font-size: 12px; font-weight: 700; color: var(--gray-600); }
    .locked-field > strong { font-size: 15px; color: var(--gray-900); }
    .locked-field > small { color: var(--gray-500); }
    .revision-form-layout { grid-template-columns: minmax(0, 760px); justify-content: center; }
    .revision-policy { display: grid; gap: var(--sp-1); }
    .revision-policy p { margin: 0; }
    .revision-source-summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sp-3); margin: 0; }
    .revision-source-summary div { display: grid; gap: var(--sp-1); padding: var(--sp-3); border: 1px solid var(--line); border-radius: var(--r-md); background: var(--gray-50); }
    .revision-source-summary dt { color: var(--gray-600); font-size: 12px; font-weight: 700; }
    .revision-source-summary dd { margin: 0; color: var(--gray-900); }
    .revision-confirm { margin-top: var(--sp-4); padding: var(--sp-3); border: 1px solid var(--action); border-radius: var(--r-md); background: var(--action-soft); }
    .revision-history { margin-top: var(--sp-4); }
    .revision-history ol { display: grid; gap: var(--sp-2); margin: var(--sp-3) 0 0; padding: 0; list-style: none; }
    .revision-history li { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); padding: var(--sp-3); border: 1px solid var(--line); border-radius: var(--r-md); }
    .revision-history li.current { border-color: var(--primary); background: var(--primary-soft); }
    .revision-history a { display: flex; align-items: center; gap: var(--sp-3); color: inherit; text-decoration: none; }
    .revision-history a span { color: var(--gray-600); }

    @media (max-width: 1180px) {
      .search-workspace-head { grid-template-columns: 1fr; }
      .floor-plan-layout { grid-template-columns: 1fr; }
      .zone-overview { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .zone-overview a { border: 1px solid var(--line); border-radius: var(--r-md); padding: var(--sp-3); }
    }
    @media (min-width: 1100px) {
      .topbar { background: var(--primary-deep); border-right-color: rgba(255, 255, 255, .12); color: var(--surface); }
      .topbar .brand { border-bottom-color: rgba(255, 255, 255, .12); }
      .topbar .brand-logo { filter: drop-shadow(0 4px 12px rgba(24, 33, 47, .18)); }
      .topbar .brand strong { color: var(--surface); letter-spacing: 0; }
      .topbar .brand small { color: rgba(255, 255, 255, .6); }
      .topbar .archive-nav-item, .topbar .nav-sub-link, .topbar .logout-link, .topbar .nav-settings summary { color: rgba(255, 255, 255, .82); }
      .topbar .nav-group-label { color: rgba(255, 255, 255, .55); }
      .topbar .nav-group.has-active > .nav-group-label { background: rgba(255, 255, 255, .12); color: var(--surface); box-shadow: inset var(--sp-1) 0 0 var(--action); }
      .topbar .archive-nav-item:hover, .topbar .nav-sub-link:hover, .topbar .logout-link:hover, .topbar .nav-settings summary:hover { background: rgba(255, 255, 255, .12); color: var(--surface); }
      .topbar .archive-nav-item.active { position: relative; background: rgba(255, 255, 255, .14); color: var(--surface); }
      .topbar .archive-nav-item.active::before { content: ""; position: absolute; left: calc(-1 * var(--sp-3)); top: var(--sp-2); bottom: var(--sp-2); width: var(--sp-1); border-radius: 0 var(--r-sm) var(--r-sm) 0; background: var(--action); }
      .topbar .nav-settings, .topbar .nav-user { border-color: rgba(255, 255, 255, .12); }
      .topbar .session-pill { background: rgba(255, 255, 255, .12); color: var(--surface); }
      .topbar .command-trigger { background: rgba(255, 255, 255, .12); border-color: rgba(255, 255, 255, .18); color: rgba(255, 255, 255, .82); }
      .topbar .command-trigger:hover { background: rgba(255, 255, 255, .18); color: var(--surface); }
      .topbar .command-trigger kbd { background: transparent; border-color: rgba(255, 255, 255, .18); color: rgba(255, 255, 255, .6); }
    }
    @media (max-width: 760px) {
      .mobile-filter-toggle { display: inline-flex; }
      .desktop-filter-controls { display: none; }
      .mobile-search-filter-button { display: inline-flex; width: 100%; justify-content: center; min-height: 44px; }
      .mobile-filter-dialog[open] { position: fixed; inset: auto 0 0; width: 100%; max-width: none; max-height: min(82vh, 720px); margin: 0; border-width: 1px 0 0; border-radius: var(--r-lg) var(--r-lg) 0 0; overflow-y: auto; }
      .mobile-filter-form { padding-bottom: max(var(--sp-5), env(safe-area-inset-bottom)); }
      .mobile-filter-dialog .viewer-filter-row { grid-template-columns: 1fr; }
      .mobile-filter-dialog .viewer-filter-row > .button { display: none; }
      .revision-source-summary { grid-template-columns: 1fr; }
      .topbar { background: var(--primary-deep); border-bottom-color: rgba(255, 255, 255, .12); color: var(--surface); }
      .topbar .brand strong { color: var(--surface); }
      .topbar .brand small, .topbar .command-trigger { display: none; }
      .topbar .brand-logo { width: 48px; height: 34px; }
      .document-detail-head { grid-template-columns: minmax(0, 1fr); max-inline-size: none; margin: calc(-1 * var(--sp-3)) calc(-1 * var(--sp-3)) var(--sp-3); padding: var(--sp-5) calc(var(--sp-4) + var(--sp-3)); border-radius: 0 0 var(--r-lg) var(--r-lg); }
      .document-detail-head .breadcrumb { display: flex; align-items: center; margin: 0; }
      .document-detail-head .breadcrumb > span { display: none; }
      .document-detail-head .breadcrumb a { display: inline-flex; align-items: center; min-height: 44px; color: var(--surface); font-weight: 700; }
      .document-detail-head .breadcrumb a::before { content: "←"; margin-right: var(--sp-2); }
      .document-detail-head .document-title-row h1 { font-size: 21px; }
      .document-title-row { flex-direction: column; }
      .document-state-badges { justify-content: flex-start; }
      .document-location-hero { align-items: stretch; flex-direction: column; gap: var(--sp-4); padding: var(--sp-4); }
      .document-location-summary strong { font-size: 19px; }
      .location-hero-actions, .location-hero-actions > * { width: 100%; }
      .location-hero-actions > * { justify-content: center; min-height: 44px; }
      .document-location-visuals { grid-template-columns: minmax(0, 1fr); }
      .document-location-visuals .doc-floor-plan { order: -1; }
      .document-location-visuals .panel { padding: var(--sp-3); overflow: hidden; }
      .document-detail-sections { grid-template-columns: minmax(0, 1fr); }
      .detail-section dl div { grid-template-columns: minmax(88px, .35fr) minmax(0, 1fr); }
      .detail-actions { padding: var(--sp-4); }
      .detail-action-groups, .detail-action-groups > div { display: grid; grid-template-columns: minmax(0, 1fr); width: 100%; }
      .detail-state-actions { padding: var(--sp-3) 0 0; border-left: 0; border-top: 1px solid var(--danger); }
      .detail-action-groups .button, .detail-action-groups button { width: 100%; justify-content: center; min-height: 44px; }
      .doc-floor-plan .floor-plan-tools { align-items: stretch; flex-direction: column; }
      .doc-floor-plan .floor-plan-tools .button { width: 100%; justify-content: center; min-height: 44px; }
      .mini-column-guide { gap: var(--sp-2); }
      .mini-column-guide strong { padding-inline: var(--sp-2); }
      .mini-compass { display: flex; border-radius: var(--r-md); line-height: 1.45; }
      .admin-status-panel { align-items: flex-start; }
      .workflow-stepper { grid-template-columns: repeat(5, minmax(0, 1fr)); margin-bottom: var(--sp-2); overflow: hidden; padding: var(--sp-3) var(--sp-2); }
      .workflow-step { grid-template-columns: 24px; justify-items: center; text-align: center; }
      .workflow-step:not(:last-child)::after { top: 12px; left: calc(50% + var(--sp-3)); right: calc(-50% + var(--sp-3)); }
      .workflow-step-index { width: 24px; height: 24px; }
      .workflow-step-copy { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
      .workflow-current-step { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--sp-1) var(--sp-3); align-items: baseline; margin: 0 0 var(--sp-4); padding: var(--sp-3) var(--sp-4); border-radius: var(--r-md); background: var(--primary-soft); }
      .workflow-current-step span { grid-row: 1 / span 2; color: var(--primary); font-size: 12px; font-weight: 800; white-space: nowrap; }
      .workflow-current-step strong { font-size: 13.5px; }
      .workflow-current-step small { color: var(--gray-600); font-size: 12px; }
      .zone-overview { grid-template-columns: 1fr; }
    }`;
}
