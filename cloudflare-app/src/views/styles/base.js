// 전역 CSS의 기본 요소와 전역 셸 조각. 순서는 styles.js에서 고정한다.

export function baseStyles() {
  return `    * { box-sizing: border-box; }
    html, body { overflow-x: hidden; }
    [hidden] { display: none !important; }
    body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; font-size: 14px; background: var(--bg); color: var(--ink); line-height: 1.55; letter-spacing: 0; -webkit-font-smoothing: antialiased; font-variant-numeric: tabular-nums; }
    a { color: inherit; }
    ::selection { background: var(--primary-soft); }
    .mono { font-family: var(--font-mono); }
    .skip-nav { position: absolute; left: -1000px; top: var(--sp-4); z-index: 1000; padding: var(--sp-2) var(--sp-3); background: var(--gray-900); color: var(--surface); border-radius: var(--r-md); }
    .skip-nav:focus { left: var(--sp-4); }
    .clipboard-proxy { position: fixed; left: -9999px; }

    h1, h2, h3, p { overflow-wrap: anywhere; }
    h1 { margin: 0; font-size: 19px; font-weight: 700; line-height: 1.3; letter-spacing: 0; }
    h2 { margin: 0; font-size: 15px; font-weight: 700; line-height: 1.35; letter-spacing: 0; }
    h3 { margin: 0; font-size: 13.5px; font-weight: 700; line-height: 1.4; }
    .page-sub { margin: var(--sp-1) 0 0; color: var(--gray-500); font-size: 12.5px; font-weight: 500; }
    .muted { color: var(--gray-500); font-size: 13px; }

    .topbar { position: sticky; top: 0; z-index: 50; display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-2) clamp(12px, 3vw, 24px); background: var(--surface); border-bottom: 1px solid var(--line); }
    .brand { display: inline-flex; align-items: center; gap: var(--sp-2); text-decoration: none; min-width: max-content; }
    .brand-logo { display: block; width: 56px; height: 40px; object-fit: contain; flex: none; }
    .brand strong, .brand small { display: block; }
    .brand strong { font-weight: 700; font-size: 14px; letter-spacing: 0; }
    .brand small { color: var(--gray-500); font-size: 11.5px; font-weight: 500; }
    .topbar nav { display: flex; align-items: center; gap: var(--sp-1); flex: 1; min-height: 0; overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
    .archive-nav-item, .nav-sub-link, .logout-link { display: inline-flex; align-items: center; gap: var(--sp-2); padding: var(--sp-2) var(--sp-3); border-radius: var(--r-md); text-decoration: none; color: var(--gray-600); font-weight: 600; font-size: 13.5px; transition: background .15s ease, color .15s ease; }
    .logout-form { display: inline; margin: 0; }
    button.logout-link { border: 0; background: transparent; cursor: pointer; font: inherit; }
    .archive-nav-item i, .nav-sub-link i, .logout-link i { font-size: .9em; opacity: .85; width: 16px; text-align: center; }
    .archive-nav-item:hover, .nav-sub-link:hover, .logout-link:hover { background: var(--gray-100); color: var(--gray-900); }
    .archive-nav-item.active { background: var(--primary-soft); color: var(--primary); }
    .nav-group { display: block; }
    .nav-primary-links { display: grid; gap: var(--sp-1); }
    .nav-group-label { display: flex; align-items: center; gap: var(--sp-2); min-height: 40px; padding: var(--sp-2) var(--sp-3); border-radius: var(--r-md); color: var(--gray-500); font-size: 12px; font-weight: 800; cursor: pointer; list-style: none; }
    .nav-group-label::-webkit-details-marker { display: none; }
    .nav-group-label::after { content: "+"; margin-left: auto; color: var(--gray-400); font-size: 15px; line-height: 1; }
    .nav-group[open] > .nav-group-label::after { content: "−"; }
    .nav-group-label:hover { background: var(--gray-100); color: var(--gray-900); }
    .nav-group.has-active > .nav-group-label { background: var(--primary-soft); color: var(--primary); }
    .nav-group-label:focus-visible, .nav-settings summary:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
    .nav-group-content { display: none; }
    .nav-group[open] > .nav-group-content { display: grid; gap: var(--sp-1); padding-top: var(--sp-1); }
    .nav-group .nav-settings { margin-top: 0; border-top: 0; padding-top: 0; }
    .nav-settings { margin-top: var(--sp-2); border-top: 1px solid var(--line); padding-top: var(--sp-2); }
    .nav-settings summary { display: flex; align-items: center; gap: var(--sp-2); padding: var(--sp-2) var(--sp-3); border-radius: var(--r-md); color: var(--gray-600); font-size: 13.5px; font-weight: 600; cursor: pointer; list-style: none; }
    .nav-settings summary::-webkit-details-marker { display: none; }
    .nav-settings summary:hover { background: var(--gray-100); color: var(--gray-900); }
    .nav-settings summary i { width: 16px; text-align: center; }
    .nav-settings > div { display: grid; gap: var(--sp-1); padding: var(--sp-1) 0 0 var(--sp-3); }
    .mobile-tabs { display: none; }
    .nav-user { margin-left: auto; display: flex; align-items: center; gap: var(--sp-1); }
    .session-pill { padding: var(--sp-1) var(--sp-3); background: var(--gray-100); border-radius: 999px; color: var(--gray-700); font-size: 12px; font-weight: 600; white-space: nowrap; }
    .command-trigger { display: inline-flex; align-items: center; gap: var(--sp-2); min-height: 34px; padding: var(--sp-1) var(--sp-2); border: 1px solid var(--line); border-radius: var(--r-md); background: var(--gray-50); color: var(--gray-600); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; }
    .command-trigger:hover { border-color: var(--gray-300); color: var(--gray-900); }
    .command-trigger kbd { padding: 1px var(--sp-1); border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--surface); color: var(--gray-500); font: inherit; font-size: 10px; }
    .drawer-close { display: none; }

    .app-shell { width: min(1440px, calc(100% - var(--sp-8))); margin: 0 auto; padding: var(--sp-5) 0 var(--sp-8); }
    .login-main { min-height: 100vh; display: grid; place-items: center; padding: var(--sp-4); }
    .login-shell { width: min(920px, 100%); display: grid; grid-template-columns: 1fr 1.05fr; min-height: 520px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); box-shadow: var(--shadow-2); overflow: hidden; }
    .login-side { display: flex; flex-direction: column; justify-content: flex-end; gap: var(--sp-3); padding: var(--sp-8); background: var(--primary-deep); color: var(--surface); }
    .login-side h1 { color: var(--surface); font-size: 24px; }
    .login-side p { color: rgba(255, 255, 255, .82); margin: 0; font-size: 13.5px; }
    .login-logo { display: block; width: min(176px, 70%); height: auto; object-fit: contain; filter: drop-shadow(0 8px 18px rgba(24, 33, 47, .18)); }
    .login-panel { padding: var(--sp-8); align-self: center; width: 100%; }
    .login-panel h2 { font-size: 19px; margin-bottom: var(--sp-4); }
    .page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--sp-4); margin: var(--sp-1) 0 var(--sp-4); }
    .breadcrumb { display: flex; gap: var(--sp-2); color: var(--gray-500); font-size: 12px; margin-bottom: var(--sp-1); }
    .breadcrumb a { text-decoration: none; }
    .breadcrumb a:hover { color: var(--primary); }
`;
}
