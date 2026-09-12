import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import { styles } from "../src/views/styles.js";
import { iconStyles } from "../src/views/icons.js";
import { tokenStyles } from "../src/views/styles/tokens.js";

const expectedTokens = {
  "--gray-50": "#f7f9fb",
  "--gray-100": "#eef1f5",
  "--gray-200": "#e1e6ed",
  "--gray-300": "#cbd3dd",
  "--gray-400": "#9aa7b8",
  "--gray-500": "#5a6a7d",
  "--gray-600": "#55647a",
  "--gray-700": "#3d4a5c",
  "--gray-800": "#283445",
  "--gray-900": "#18212f",
  "--bg": "#f3f5f8",
  "--surface": "#ffffff",
  "--ink": "var(--gray-900)",
  "--muted": "var(--gray-500)",
  "--line": "var(--gray-200)",
  "--primary": "#1e55c4",
  "--primary-strong": "#17439f",
  "--primary-soft": "#e9effb",
  "--primary-deep": "#122c63",
  "--action": "#ffd43b",
  "--action-strong": "#f3c623",
  "--action-soft": "#fff7cf",
  "--action-ink": "#18212f",
  "--hero-bg": "linear-gradient(135deg, var(--primary-deep), var(--primary))",
  "--success": "#0c7a43",
  "--success-soft": "#e5f4eb",
  "--warning": "#9a5b00",
  "--warning-soft": "#fdf1dd",
  "--danger": "#c22f2f",
  "--danger-soft": "#fbecec",
  "--ring": "rgba(30, 85, 196, .22)",
  "--scrim": "rgba(24, 33, 47, .5)",
  "--shadow-1": "0 4px 16px rgba(24, 33, 47, .08)",
  "--shadow-2": "0 12px 40px rgba(24, 33, 47, .18)",
  "--r-lg": "10px",
  "--r-md": "8px",
  "--r-sm": "6px",
  "--sp-1": "4px",
  "--sp-2": "8px",
  "--sp-3": "12px",
  "--sp-4": "16px",
  "--sp-5": "20px",
  "--sp-6": "24px",
  "--sp-8": "32px",
  "--text-title": "22px",
  "--text-section": "16px",
  "--text-body": "14px",
  "--text-meta": "12.5px",
  "--control-height": "40px",
  "--touch-height": "44px",
  "--preview-width": "320px",
  "--preview-inline-min": "1040px",
  "--text-identity": "14px",
  "--rack-axis-width": "24px",
  "--font-mono": "ui-monospace, \"Cascadia Code\", \"SF Mono\", Consolas, monospace"
};

const approvedRgbaValues = [
  "rgba(24, 33, 47, .08)",
  "rgba(24, 33, 47, .18)",
  "rgba(24, 33, 47, .5)",
  "rgba(30, 85, 196, .05)",
  "rgba(30, 85, 196, .22)",
  "rgba(30, 85, 196, .45)",
  "rgba(255, 255, 255, .12)",
  "rgba(255, 255, 255, .14)",
  "rgba(255, 255, 255, .05)",
  "rgba(255, 255, 255, .18)",
  "rgba(255, 255, 255, .4)",
  "rgba(255, 255, 255, .55)",
  "rgba(255, 255, 255, .6)",
  "rgba(255, 255, 255, .82)",
  "rgba(255, 255, 255, .92)"
];

const runtimeGeometryVariables = new Set([
  "--grid-min",
  "--height",
  "--left",
  "--rack-left",
  "--rack-width",
  "--top",
  "--width",
  "--z-ah",
  "--z-aw",
  "--zh",
  "--zl",
  "--zt",
  "--zw"
]);

test("전역 CSS는 desktop·mobile·print·reduced-motion 계약을 포함한다", () => {
  const css = styles();

  assert.match(css, /@media \(min-width: 1100px\)/);
  assert.match(css, /@media \(max-width: 1099px\)[\s\S]*\.mobile-tabs/);
  assert.match(css, /\.doc-floor-plan-scroll\.is-zoomed[\s\S]*overflow-x: auto/);
  assert.match(css, /\.mini-rack-scroll[\s\S]*overflow-x: auto/);
  assert.doesNotMatch(css, /location-find|find-step-heading|rack-label-check|is-location-finding/);
  assert.match(css, /\.mobile-filter-dialog\[open\][\s\S]*position: fixed/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /@media print[\s\S]*\.print-only/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.viewer-result-table/);
  assert.match(css, /\.bulk-bar \{ position: fixed;/);
  assert.match(css, /\.app-shell:has\(\.bulk-bar:not\(\[hidden\]\)\)/);
  assert.match(css, /@media \(min-width: 1100px\)[\s\S]*\.bulk-bar \{ left: calc\(240px \+ var\(--sp-6\)\)/);
  assert.match(css, /\.bulk-check-target \{ display: grid; width: 44px; min-height: 44px;/);
  assert.match(css, /\.archive-map/);
  assert.match(css, /\.search-home-hero \{ position: relative;[\s\S]*min-height: 160px/);
  assert.match(css, /\.search-home \.search-results-controls \{ margin-top: 0; \}/);
  assert.doesNotMatch(css, /\.viewer-search-form\.is-home \.filter-details \{ display: none; \}/);
  assert.match(css, /\.metric-strip \{ display: grid; grid-template-columns: repeat\(auto-fit/);
  assert.match(css, /\.viewer-workspace\.has-preview/);
  assert.doesNotMatch(css, /@media \(min-width: 1181px\)/);
  assert.match(css, /\.command-palette-list a\.is-active/);
  assert.match(css, /\.floor-rack-search \{ flex: 0 1 auto; width: 100%; max-width: none; \}/);
  assert.match(css, /input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\):not\(\[type="hidden"\]\), select, textarea \{ min-height: 44px; font-size: 16px; \}/);
  assert.match(css, /input\[type="checkbox"\], input\[type="radio"\] \{ flex: none; width: 20px; min-width: 20px; min-height: 20px; padding: 0; justify-self: start; \}/);
  assert.match(css, /\.viewer-result-table \.viewer-result-row[\s\S]*display: flex/);
  assert.match(css, /\.viewer-result-row \.viewer-result-location \{ width: 100%; \}/);
  assert.match(css, /\.viewer-result-table \.viewer-result-row \.check-col \{ position: absolute;[^}]*width: var\(--touch-height\)/);
  assert.match(css, /\.viewer-result-name a \{ display: block; overflow: visible; -webkit-line-clamp: unset; \}/);
  assert.match(css, /\.viewer-result-identity \{ display: flex; flex-wrap: wrap;/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.workflow-stepper \{ grid-template-columns: repeat\(5, minmax\(0, 1fr\)\);[^}]*overflow: hidden/);
  assert.match(css, /\.workflow-current-step \{ display: grid; grid-template-columns: auto minmax\(0, 1fr\)/);
  assert.match(css, /\.mini-rack-grid \{ inline-size: 100%; min-inline-size: 0; grid-template-columns: repeat\(var\(--cols\), minmax\(0, 1fr\)\)/);
  assert.match(css, /\.modal, \.modal\.disposal-review-modal \{ width: calc\(100vw - var\(--sp-6\)\);[^}]*overflow-x: clip/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.modal-actions \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /\.zone-rack-links a \{ min-height: 44px; align-items: center; \}/);
  assert.match(css, /\.help-task-grid \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /\.master-create-form \{ display: grid; grid-template-columns: minmax\(180px, 1fr\) minmax\(260px, 2fr\) auto/);
  assert.match(css, /\.category-master-summary \{ display: grid; grid-template-columns: minmax\(0, 1fr\) auto auto;[^}]*min-height: 56px/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.master-create-form, \.category-master-edit-form \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.category-master-toggle \{ width: 44px; min-height: 44px;/);
  assert.match(css, /\.document-detail-head \{ grid-template-columns: minmax\(0, 1fr\); max-inline-size: none; margin: calc\(-1 \* var\(--sp-3\)\) calc\(-1 \* var\(--sp-3\)\) var\(--sp-3\); padding: var\(--sp-5\) calc\(var\(--sp-4\) \+ var\(--sp-3\)\)/);
  assert.match(css, /\.icon-button \{ min-height: 36px; width: 36px;[\s\S]*color: var\(--gray-600\)/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.icon-button \{ width: 44px; \}/);
  assert.match(css, /input::placeholder, textarea::placeholder \{ color: var\(--gray-500\); \}/);
  assert.match(css, /\.status\.document-active,[\s\S]*\.status\.account-review/);
  assert.doesNotMatch(css, /\.status\.(?:active|disposed|pending|neutral)\b/);
  assert.doesNotMatch(css, /\.answer-card\b|\.doc-row\b|\.operation-hero\b|\.hero-kicker\b|\.ledger-method|\.disposal-targets-layout\b/);
});

test("CSS 변수 참조는 토큰 또는 명시적인 런타임 기하 변수로 해석된다", () => {
  const css = styles();
  const defined = new Set(
    [...css.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((match) => match[1])
  );
  const referenced = new Set(
    [...css.matchAll(/var\((--[a-z0-9-]+)/gi)].map((match) => match[1])
  );
  const undefinedVariables = [...referenced]
    .filter((name) => !defined.has(name) && !runtimeGeometryVariables.has(name))
    .sort();

  assert.deepEqual(undefinedVariables, []);
});

test("상태 배지는 색 이름이 아니라 업무 의미 클래스를 사용한다", () => {
  const viewsDirectory = new URL("../src/views/", import.meta.url);
  const files = readdirSync(viewsDirectory, { recursive: true })
    .filter((name) => String(name).endsWith(".js"));
  const source = files
    .map((name) => readFileSync(new URL(String(name).replaceAll("\\", "/"), viewsDirectory), "utf8"))
    .join("\n");

  assert.doesNotMatch(source, /class=["'`]status (?:active|disposed|pending|neutral)\b/);
  for (const className of [
    "document-active",
    "document-disposed",
    "account-approved",
    "account-disabled",
    "account-rejected",
    "account-pending",
    "account-review",
    "ledger-current",
    "ledger-excluded",
    "campaign-completed",
    "import-completed",
    "snapshot-completed",
    "review-pending"
  ]) {
    assert.match(source, new RegExp(`\\b${className}\\b`), `${className} 상태 클래스가 없습니다.`);
  }
});

test("view 소스는 CSP가 차단하는 style 속성과 동적 CSSOM mutation을 만들지 않는다", () => {
  const viewsDirectory = new URL("../src/views/", import.meta.url);
  const files = readdirSync(viewsDirectory, { recursive: true })
    .filter((name) => String(name).endsWith(".js"));

  for (const name of files) {
    const source = readFileSync(new URL(String(name).replaceAll("\\", "/"), viewsDirectory), "utf8");
    assert.doesNotMatch(source, /\sstyle\s*=/i, `${name}에 style 속성이 있습니다.`);
    assert.doesNotMatch(source, /\.style\./, `${name}에 동적 CSSOM style mutation이 있습니다.`);
  }
});

test("DESIGN 토큰 값은 전용 조각에 그대로 고정된다", () => {
  const actualTokens = Object.fromEntries(
    [...tokenStyles().matchAll(/^\s+(--[\w-]+):\s*([^;]+);$/gm)]
      .map((match) => [match[1], match[2]])
  );

  assert.deepEqual(actualTokens, expectedTokens);
});

test("원시 hex는 토큰 조각에만 있고 rgba는 승인된 예외만 사용한다", () => {
  const stylesDirectory = new URL("../src/views/styles/", import.meta.url);
  const files = readdirSync(stylesDirectory).filter((name) => name.endsWith(".js"));
  const sources = files.map((name) => [name, readFileSync(new URL(name, stylesDirectory), "utf8")]);

  for (const [name, source] of sources) {
    if (name !== "tokens.js") {
      assert.doesNotMatch(source, /#[0-9a-f]{3,8}\b/gi, `${name}에 원시 hex가 있습니다.`);
    }
  }

  const rgbaValues = [...new Set(
    sources.flatMap(([, source]) => source.match(/rgba\([^)]*\)/g) || [])
  )].sort();
  assert.deepEqual(rgbaValues, [...approvedRgbaValues].sort());
});

// 마스크가 없는 fa-* 이름은 배경색 사각형으로 렌더되므로 사용 이름 전체를 정의와 대조한다.
test("모든 fa-* 아이콘 이름은 로컬 SVG 마스크 정의를 가진다", () => {
  const viewsDirectory = new URL("../src/views/", import.meta.url);
  const sourceFiles = [];
  const collect = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const target = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
      if (entry.isDirectory()) collect(target);
      else if (entry.name.endsWith(".js")) sourceFiles.push(readFileSync(target, "utf8"));
    }
  };
  collect(viewsDirectory);

  const usedNames = new Set();
  for (const source of sourceFiles) {
    for (const [name] of source.matchAll(/fa-[a-z0-9-]+/g)) usedNames.add(name);
  }
  usedNames.delete("fa-solid");
  usedNames.delete("fa-regular");

  const css = iconStyles();
  const missing = [...usedNames]
    .filter((name) => !css.includes(`.${name}{`) && !css.includes(`.${name},`))
    .sort();
  assert.deepEqual(missing, [], `마스크가 없는 아이콘: ${missing.join(", ")}`);
});
