import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

import { escapeHtml } from "../src/ui/html/escape.js";
import { EXCEL_SNAPSHOT_HEADERS } from "../src/domains/snapshots/domain/workbookSchema.js";
import * as clientScriptModule from "../src/views/clientScript.js";
import { excelSnapshotScript } from "../src/views/clientScript/excelSnapshots.js";
import { navigationFeedbackScript, TOAST_MESSAGES } from "../src/views/clientScript/navigationFeedback.js";

function sourceModules(directory = new URL("../src/", import.meta.url)) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    if (entry.isDirectory()) return sourceModules(url);
    return entry.isFile() && entry.name.endsWith(".js") ? [readFileSync(url, "utf8")] : [];
  });
}

function producedToastKeys() {
  const keys = new Set();
  const addMatches = (source, pattern, indexes = [1]) => {
    for (const match of source.matchAll(pattern)) {
      for (const index of indexes) {
        if (match[index]) keys.add(match[index]);
      }
    }
  };
  for (const source of sourceModules()) {
    addMatches(source, /[?&]toast=([a-z][a-z0-9-]*)/g);
    addMatches(source, /withToast\([^,\n]+,\s*["']([a-z][a-z0-9-]*)["']/g);
    addMatches(source, /toast=\$\{[^}]*\?\s*["']([a-z][a-z0-9-]*)["']\s*:\s*["']([a-z][a-z0-9-]*)["'][^}]*\}/g, [1, 2]);
    addMatches(source, /\b(?:const|let|var)\s+toast\s*=\s*[^;]*\?\s*["']([a-z][a-z0-9-]*)["']\s*:\s*["']([a-z][a-z0-9-]*)["']/g, [1, 2]);
  }
  return [...keys].sort();
}

test("전역 클라이언트 스크립트는 한 번 초기화되고 문법적으로 실행 가능하다", () => {
  const script = clientScriptModule.clientScript();

  assert.deepEqual(Object.keys(clientScriptModule).sort(), ["clientScript", "searchCoreScript"]);
  assert.equal((script.match(/DOMContentLoaded/g) || []).length, 1);
  assert.doesNotThrow(() => new Function(script));
});

test("정적 client 조립은 직렬화 소스·초기화 순서·검색 계약을 유지한다", () => {
  const script = clientScriptModule.clientScript();
  const searchCoreTag = clientScriptModule.searchCoreScript();
  assert.equal(searchCoreTag, `<script type="module" src="/assets/search-core.js"></script>`);
  assert.doesNotMatch(script, /window\.__name|createSearchCore\.toString/);
  assert.doesNotMatch(script, /excelSnapshotMaxItems|data-excel-snapshot-upload/);
  assert.ok(script.includes(`var escapeHtmlClient = (${escapeHtml.toString()});`));

  const orderedMarkers = [
    "DOMContentLoaded",
    "[data-suggest-input]",
    "[data-bulk-bar]",
    "var currentPath = location.pathname;",
    "var viewerApp = document.querySelector('[data-viewer-app]');",
    "viewer-result-table",
    "fetch('/api/viewer/search?'"
  ];
  let previousIndex = -1;
  for (const marker of orderedMarkers) {
    const markerIndex = script.indexOf(marker);
    assert.ok(markerIndex > previousIndex, `${marker} 실행 순서가 바뀌었습니다.`);
    previousIndex = markerIndex;
  }

  assert.ok(script.includes("'/api/search-suggestions?q=' + encodeURIComponent(q)"));
  assert.ok(script.includes("검색 중…"));
  assert.ok(script.includes("검색 결과가 없습니다."));
  assert.ok(script.includes("window.HanlimResults.resultRow"));
  assert.ok(script.includes("window.HanlimResults.resultTable"));
  assert.ok(script.includes("data-search-more"));
  assert.ok(script.includes("payload.nextCursor"));
  assert.doesNotMatch(script, /fetch\('\/api\/search-index'/);
});

test("최초 비밀번호 변경 모달은 자동으로 열리고 Escape로 닫히지 않는다", () => {
  const script = clientScriptModule.clientScript();

  assert.match(script, /\[data-auto-open-modal\]/);
  assert.match(script, /data-forced-modal/);
  assert.match(script, /modal\.addEventListener\('cancel', function \(event\) \{ event\.preventDefault\(\); \}\)/);
  assert.match(script, /if \(modal\.open\) modal\.close\(\);[\s\S]*modal\.showModal\(\);/);
});

test("명령 팔레트는 키보드 이동과 포커스 복귀 계약을 유지한다", () => {
  const script = clientScriptModule.clientScript();

  for (const key of ["ArrowDown", "ArrowUp", "Home", "End", "Enter", "Escape"]) {
    assert.match(script, new RegExp(`event\\.key === '${key}'`));
  }
  assert.match(script, /commandPreviousFocus = document\.activeElement/);
  assert.match(script, /commandPreviousFocus\.focus\(\)/);
  assert.match(script, /scrollIntoView\(\{ block: 'nearest' \}\)/);
});

test("접이식 내비게이션은 현재 그룹을 열고 사용자가 연 상태를 기억한다", () => {
  const script = clientScriptModule.clientScript();

  assert.match(script, /var currentUrl = new URL\(location\.href\)/);
  assert.match(script, /itemUrl\.searchParams\.entries\(\)/);
  assert.match(script, /currentUrl\.searchParams\.getAll\(entry\[0\]\)\.includes\(entry\[1\]\)/);
  assert.match(script, /hanlimNavigationGroups/);
  assert.match(script, /document\.querySelectorAll\('\[data-nav-group\]'\)/);
  assert.match(script, /group\.classList\.toggle\('has-active', hasActiveItem\)/);
  assert.match(script, /group\.open = hasActiveItem \|\| storedNavigationGroups\.includes\(key\)/);
  assert.match(script, /group\.addEventListener\('toggle'/);
  assert.match(script, /localStorage\.setItem\('hanlimNavigationGroups'/);
});

test("쿼리 기반 내비게이션은 추가 검색 조건이 있어도 가장 구체적인 메뉴를 활성화한다", () => {
  const item = (href) => ({
    href,
    attributes: {},
    classList: { add() {} },
    getAttribute(name) { return name === "href" ? href : this.attributes[name] || null; },
    setAttribute(name, value) { this.attributes[name] = value; }
  });
  const baseItem = item("/documents/disposal");
  const disposedItem = item("/documents/disposal?tab=documents");
  const document = {
    querySelectorAll(selector) {
      return selector.includes("archive-nav-item") ? [baseItem, disposedItem] : [];
    },
    querySelector() { return null; },
    addEventListener() {}
  };

  vm.runInNewContext(navigationFeedbackScript(), {
    Array,
    URL,
    URLSearchParams,
    document,
    history: { replaceState() {} },
    localStorage: { getItem() { return "[]"; }, setItem() {} },
    location: {
      href: "https://example.test/documents/disposal?tab=documents&q=PV",
      origin: "https://example.test",
      pathname: "/documents/disposal",
      search: "?tab=documents&q=PV"
    },
    navigator: {},
    window: {}
  });

  assert.equal(baseItem.attributes["aria-current"], undefined);
  assert.equal(disposedItem.attributes["aria-current"], "page");
});

test("대분류 관리 목록은 이름·설명과 사용 상태로 즉시 좁혀 본다", () => {
  const script = clientScriptModule.clientScript();

  assert.match(script, /document\.querySelectorAll\('\[data-master-management\]'\)/);
  assert.match(script, /data-master-search/);
  assert.match(script, /data-master-inactive-toggle/);
  assert.match(script, /row\.dataset\.masterActive === 'true' \|\| showInactive/);
  assert.match(script, /normalizeMasterText\(row\.dataset\.masterSearchText\)\.includes\(query\)/);
  assert.match(script, /row\.hidden = !matches/);
  assert.match(script, /if \(!matches && row\.open\) row\.open = false/);
});

test("문서 작업 공간은 검색 단축키·행 탐색·열 설정·선택 폼을 연결한다", () => {
  const script = clientScriptModule.clientScript();

  assert.match(script, /event\.key === '\/'/);
  assert.match(script, /event\.key === 'ArrowDown'/);
  assert.match(script, /event\.key === 'ArrowUp'/);
  assert.match(script, /data-document-preview/);
  assert.match(script, /getBoundingClientRect\(\)\.width >= previewInlineMinimum/);
  assert.doesNotMatch(script, /\(min-width: 1181px\)/);
  assert.match(script, /hanlimDocumentColumns/);
  assert.match(script, /data-set-selection-form/);
  assert.match(script, /data-disposal-limit/);
});

test("즉시 검색 DOM 교체는 화면에 남은 선택만 일괄 작업 상태로 동기화한다", () => {
  const script = clientScriptModule.clientScript();

  assert.match(script, /var replaceResults = function \(html, preserveSelection\)/);
  assert.match(script, /new Set\(Array\.from\(document\.querySelectorAll\('\[data-bulk-item\]:checked'\)\)/);
  assert.match(script, /item\.checked = selectedIds\.has\(item\.value\)/);
  assert.match(script, /if \(!append\) resetSearchSelection\(\)/);
  assert.match(script, /list\.insertAdjacentHTML\('beforeend', listHtml\)/);
  assert.match(script, /resultsBody\.insertAdjacentHTML\('beforeend', '<nav class="pagination">/);
  assert.doesNotMatch(script, /replaceResults\(html, append\)/);
  assert.match(script, /replaceResults\(html, false\)/);
  assert.match(script, /viewerApp\.hidden = false/);
  assert.doesNotMatch(script, /viewerApp\.hidden = true/);
  assert.match(script, /syncBulk\(\);/);
  assert.match(script, /var syncWorkspaceReturnTo = function \(\)/);
  assert.match(script, /params\.delete\('limit'\)/);
  assert.match(script, /document\.querySelectorAll\('\[data-workspace-return-to\]'\)/);
  assert.match(script, /input\.value = returnTo/);
  assert.match(script, /document\.addEventListener\('change', function \(event\)/);
  assert.match(script, /control\.form !== viewerForm/);
  assert.match(script, /syncFilterUi\(\);[\s\S]*requestSearch\('', false\)/);
});

test("viewer filters use one live-search path on desktop and mobile", () => {
  const script = clientScriptModule.clientScript();

  assert.match(script, /data-mobile-viewer-filter/);
  assert.match(script, /mobileFilterForm\?\.addEventListener\?\.\('submit'/);
  assert.match(script, /event\.preventDefault\(\);[\s\S]*setFormValue\(viewerForm/);
  assert.match(script, /mobileFilterDialog\?\.close\(\);[\s\S]*requestSearch\('', false\)/);
  assert.match(script, /data-viewer-filter-reset/);
  assert.match(script, /data-viewer-clear-filter/);
  assert.match(script, /data-viewer-set-filter/);
  assert.match(script, /data-viewer-remove-token/);
  assert.match(script, /sequence !== searchSequence/);
  assert.match(script, /'보관중 문서'/);
  assert.match(script, /history\.replaceState\(null, '', '\/app'/);
  assert.match(script, /mobileFilterDialog\?\.close\(\);[\s\S]*syncBrowserUrl\(\);[\s\S]*requestSearch\('', false\)/);
  assert.match(script, /window\.SearchCore\.parseSearchQuery/);
  assert.match(script, /params\.set\('resolved', '1'\)/);
  assert.match(script, /searchRequestParams\(cursor\)\.toString\(\)/);
  assert.match(script, /viewerContext\.categories/);
  assert.match(script, /viewerContext\.tags/);
  assert.match(script, /payload\.candidateCount !== null && payload\.candidateCount !== undefined/);
  assert.match(script, /Array\.isArray\(payload\.suggestions\)/);
  assert.match(script, /if \(input\.closest\('\[data-viewer-form\]'\)\) \{/);
  assert.match(script, /compositionstart/);
  assert.match(script, /control\.form\?\.matches\('\[data-viewer-form\]'\)/);
  assert.doesNotMatch(script, /viewerForm\.addEventListener\?\.\('change', syncWorkspaceReturnTo\)/);
});

test("interactive results share native table rendering and one empty reset", () => {
  const script = clientScriptModule.clientScript();
  assert.match(script, /window.HanlimResults.resultRow/);
  assert.match(script, /window.HanlimResults.resultTable/);
  assert.match(script, /data-preview-open/);
  assert.match(script, /data-viewer-search-reset/);
  assert.doesNotMatch(script, /role="grid"/);

});

test("라우트가 생산하는 전역 토스트 키는 모두 표시 문구를 가진다", () => {
  const keys = producedToastKeys();
  assert.ok(keys.length > 0, "생산된 토스트 키를 찾지 못했습니다.");
  for (const key of keys) {
    assert.equal(typeof TOAST_MESSAGES[key], "string", `${key} 토스트 문구가 필요합니다.`);
    assert.ok(TOAST_MESSAGES[key].length > 0);
  }
});

test("브라우저 CSV helper는 공백·제어문자 뒤 수식 접두어도 실제로 중화한다", () => {
  const script = excelSnapshotScript();
  const patternMatch = script.match(/var excelCsvFormulaPrefix = new RegExp\(("(?:\\.|[^"\\])*")\);/);
  const helperMatch = script.match(/function excelCsvCell\(value\) \{([\s\S]*?)\n      \}\n\n      document\.querySelectorAll\('\[data-snapshot-errors-csv\]'/);
  assert.ok(patternMatch);
  assert.ok(helperMatch);

  const excelCsvFormulaPrefix = new RegExp(JSON.parse(patternMatch[1]));
  const excelCsvCell = new Function(
    "excelCsvFormulaPrefix",
    `return function excelCsvCell(value) {${helperMatch[1]}\n}`
  )(excelCsvFormulaPrefix);

  assert.equal(excelCsvCell("\t=SUM(A1:A2)"), `"'\t=SUM(A1:A2)"`);
  assert.equal(excelCsvCell("\u00A0+1"), `"'\u00A0+1"`);
  assert.equal(excelCsvCell("\u0000@cmd"), `"'\u0000@cmd"`);
  assert.equal(excelCsvCell("일반 값"), `"일반 값"`);
});

test("인쇄용 관리대장은 담당자·확인자 서명란을 반복 인쇄되는 셀로 만든다", () => {
  const script = excelSnapshotScript();

  assert.deepEqual(EXCEL_SNAPSHOT_HEADERS.slice(5, 8), ["문서종류", "랙 위치 (구역)", "랙 위치 (번호)"]);
  assert.match(script, /한글 14개 열[\s\S]*현재 대장을 다시 추출하세요/);
  assert.ok(script.includes("print.mergeCells('A2:J3')"));
  assert.ok(script.includes("['K2:L2', 'K3:L3', '담당자"));
  assert.ok(script.includes("['M2:N2', 'M3:N3', '확인자"));
  assert.equal((script.match(/print\.mergeCells\(signatureBlock\[[01]\]\)/g) || []).length, 2);
  assert.match(script, /담당자\\nThe Person in charge/);
  assert.match(script, /확인자\\nConfirmed by/);
  assert.match(script, /print\.getRow\(2\)\.height = 60/);
  assert.match(script, /print\.getRow\(3\)\.height = 60/);
  assert.match(script, /var printDocuments = payload\.documents\.filter/);
  assert.match(script, /String\(document\.status \|\| ''\) !== '폐기'/);
  assert.match(script, /var printLastRow = Math\.max\(4, printDocuments\.length \+ 4\)/);
  assert.match(script, /paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0/);
  assert.match(script, /printArea: 'A1:N' \+ printLastRow/);
  assert.match(script, /printTitlesRow: '1:4'/);
  assert.doesNotMatch(script, /addPageBreak|printMaxRowsPerPage|printBreakOffset/);
  assert.match(script, /폐기 문서를 제외하며, A4 가로, A~N열 한 페이지 너비와 마지막 데이터 행까지/);
  assert.match(script, /oddHeader = '&L별첨 15\. 문서 목록 Document List'/);
  assert.match(script, /oddFooter = '&C&P \/ &N&RHLF-GR-04-15 \/ Rev\.2'/);
  assert.doesNotMatch(script, /&L한림 문서고/);
  assert.doesNotMatch(script, /print\.addImage|print\.images\.add|addWorksheet\('Sheet2'/);
  assert.doesNotMatch(script, /'확인: +'/);
  assert.doesNotMatch(script, /print\.getCell\('A2'\)\.(?:value|font|alignment)/);
  assert.doesNotMatch(script, /대장 버전/);
});

test("Excel 숫자 연도와 제·개정일 작성 안내는 연도 정밀도를 보존한다", () => {
  const script = excelSnapshotScript();
  assert.match(script, /Number\.isInteger\(value\) && value >= 1000 && value <= 9999/);
  assert.match(script, /연도만 아는 경우 YYYY/);
  assert.match(script, /YYYY\.MM\.DD/);
});
