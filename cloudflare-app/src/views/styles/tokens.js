// 전역 CSS의 디자인 토큰 조각. 순서는 styles.js에서 고정한다.

export function tokenStyles() {
  return `    :root {
      color-scheme: light;
      --gray-50: #f7f9fb;
      --gray-100: #eef1f5;
      --gray-200: #e1e6ed;
      --gray-300: #cbd3dd;
      --gray-400: #9aa7b8;
      --gray-500: #5a6a7d;
      --gray-600: #55647a;
      --gray-700: #3d4a5c;
      --gray-800: #283445;
      --gray-900: #18212f;
      --bg: #f3f5f8;
      --surface: #ffffff;
      --ink: var(--gray-900);
      --muted: var(--gray-500);
      --line: var(--gray-200);
      --primary: #1e55c4;
      --primary-strong: #17439f;
      --primary-soft: #e9effb;
      --primary-deep: #122c63;
      --action: #ffd43b;
      --action-strong: #f3c623;
      --action-soft: #fff7cf;
      --action-ink: #18212f;
      --hero-bg: linear-gradient(135deg, var(--primary-deep), var(--primary));
      --success: #0c7a43;
      --success-soft: #e5f4eb;
      --warning: #9a5b00;
      --warning-soft: #fdf1dd;
      --danger: #c22f2f;
      --danger-soft: #fbecec;
      --ring: rgba(30, 85, 196, .22);
      --scrim: rgba(24, 33, 47, .5);
      --shadow-1: 0 4px 16px rgba(24, 33, 47, .08);
      --shadow-2: 0 12px 40px rgba(24, 33, 47, .18);
      --r-lg: 10px;
      --r-md: 8px;
      --r-sm: 6px;
      --sp-1: 4px;
      --sp-2: 8px;
      --sp-3: 12px;
      --sp-4: 16px;
      --sp-5: 20px;
      --sp-6: 24px;
      --sp-8: 32px;
      --text-title: 22px;
      --text-section: 16px;
      --text-body: 14px;
      --text-meta: 12.5px;
      --control-height: 40px;
      --touch-height: 44px;
      --preview-width: 320px;
      --font-mono: ui-monospace, "Cascadia Code", "SF Mono", Consolas, monospace;
    }`;
}
