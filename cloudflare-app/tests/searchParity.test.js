import * as HanlimResults from "../src/views/searchResultMarkup.js";
import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { sharedSearchCore as browserSearchCore } from "../public/assets/search-core.js";
import { createSearchCore } from "../src/searchCore.js";
import { clientScript, searchCoreScript } from "../src/views/clientScript.js";
import { dashboardPage } from "../src/views/searchViews.js";

const SESSION = {
  username: "viewer",
  displayName: "조회자",
  role: "User",
  csrfToken: "csrf-token"
};

function serverItem(overrides = {}) {
  return {
    id: 7,
    documentNumber: "PV-2026-014",
    revisionNumber: "Rev.1",
    revisionDate: "2026-04-14",
    disposalDueYear: 2031,
    documentName: "충전 공정 밸리데이션 보고서",
    categoryName: "PV",
    status: "active",
    location: {
      label: "1구역 / 1-1번 랙 / 2열 / 3선반",
      zoneNumber: 1,
      rackCode: "1-01",
      rackLabel: "1-1",
      columnNumber: 2,
      shelfNumber: 3
    },
    relevanceScore: 500,
    ...overrides
  };
}

function browserItem(overrides = {}) {
  return {
    id: 7,
    document_number: "PV-2026-014",
    revision_number: "Rev.1",
    revision_date: "2026-04-14",
    disposal_due_year: 2031,
    document_name: "충전 공정 밸리데이션 보고서",
    category_name: "PV",
    tag_names: "밸리데이션",
    status: "active",
    zone_number: 1,
    rack_code: "1-01",
    rack_number: 1,
    rack_face: "A",
    is_single_sided: 0,
    column_number: 2,
    shelf_number: 3,
    updated_at: "2026-07-17",
    popularity: 0,
    ...overrides
  };
}

function answerHead(html) {
  return html.match(/<div class="answer-head">[\s\S]*?<\/div>/)?.[0] || "";
}

function serverResultsBody(html) {
  const start = html.indexOf("<div data-results-body>");
  const end = html.indexOf("\n        </div>\n      </article>", start);
  return start >= 0 && end >= 0 ? html.slice(start, end) : "";
}

async function renderServer(items, query, totalItems = items.length) {
  const response = dashboardPage({
    session: SESSION,
    query,
    viewerSearch: {
      items,
      pagination: { page: 1, pageSize: 12, totalItems, totalPages: 1 },
      suggestions: []
    },
    categories: [],
    tags: [],
    filters: { sort: "relevance" }
  });
  return response.text();
}

async function renderBrowser(items, query) {
  const listeners = {};
  const inputListeners = {};
  const input = {
    value: query,
    addEventListener(type, handler) {
      inputListeners[type] = handler;
    }
  };
  const resultsBody = { innerHTML: "" };
  const resultsTitle = { textContent: "" };
  const resultsCount = { textContent: "" };
  const viewerApp = {
    hidden: false,
    dataset: {},
    setAttribute() {},
    classList: { contains() { return false; } }
  };
  const viewerForm = {
    addEventListener() {},
    querySelector(selector) {
      if (selector === 'input[name="q"]') return input;
      if (selector === 'select[name="status"]') return { value: "active" };
      if (selector === 'select[name="sort"]') return { value: "relevance" };
      if (selector.startsWith('select[name="')) return { value: "" };
      return null;
    }
  };
  const selectors = new Map([
    ["[data-viewer-app]", viewerApp],
    ["[data-viewer-form]", viewerForm],
    ["[data-viewer-context]", { textContent: "{}" }],
    ["[data-results-body]", resultsBody],
    ["[data-results-title]", resultsTitle],
    ["[data-results-count]", resultsCount]
  ]);
  const document = {
    body: { dataset: {} },
    dispatchEvent() {},
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    querySelector(selector) {
      return selectors.get(selector) || null;
    },
    querySelectorAll() {
      return [];
    }
  };
  const sandbox = {
    clearTimeout() {},
    console,
    document,
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        items,
        candidateCount: items.length,
        hasMore: false,
        nextCursor: ""
      })
    }),
    location: { href: "https://archive.example.com/app", pathname: "/app", search: "" },
    navigator: {},
    setTimeout(handler) {
      handler();
      return 1;
    },
    URL,
    URLSearchParams
  };
  sandbox.window = sandbox;
  sandbox.SearchCore = browserSearchCore;
  sandbox.HanlimResults = HanlimResults;
  sandbox.Event = Event;
  sandbox.addEventListener = () => {};

  const context = vm.createContext(sandbox);
  vm.runInContext(clientScript(), context);
  listeners.DOMContentLoaded();
  await new Promise((resolve) => setImmediate(resolve));

  return {
    html: resultsBody.innerHTML,
    title: resultsTitle.textContent,
    count: resultsCount.textContent,
    core: sandbox.SearchCore
  };
}

test("server and browser keep the exact-code row fields and key markup", async () => {
  const query = "PV-2026-014";
  const serverHtml = serverResultsBody(await renderServer([serverItem()], query));
  const browser = await renderBrowser([serverItem()], query);

  assert.doesNotMatch(serverHtml, /data-answer-card/);
  assert.doesNotMatch(browser.html, /data-answer-card/);
  assert.match(serverHtml, /viewer-result-table/);
  assert.match(browser.html, /^<div class="viewer-result-table"/);
  for (const html of [serverHtml, browser.html]) {
    assert.match(html, /<table aria-label="문서 검색 결과">/);
    assert.doesNotMatch(html, /role="grid"|tabindex="0"|aria-selected/);
    assert.match(html, /data-doc-click="7">충전 공정 밸리데이션 보고서<\/a>/);
    assert.match(html, /<small>Rev.1<\/small>/);
    assert.match(html, /<mark>PV<\/mark>-<mark>2026<\/mark>-<mark>014<\/mark>/);
    assert.match(html, /viewer-result-category" data-label="대분류">PV<\/td>/);
    assert.match(html, /data-label="보관 위치">1구역 \/ 1-1번 랙 \/ 2열 \/ 3선반<\/td>/);
    assert.match(html, /data-preview-open/);
  }
  assert.equal(browser.title, "보관중 문서");
  assert.equal(browser.count, "1건 표시");
});

test("server and browser always keep row-only behavior for dominant and ambiguous matches", async () => {
  const query = "밸리데이션";
  const dominantServer = [
    serverItem({ relevanceScore: 300 }),
    serverItem({ id: 8, documentNumber: "PV-2026-015", relevanceScore: 200 })
  ];
  const dominantBrowser = [
    serverItem({ documentName: "밸리데이션", relevanceScore: 300 }),
    serverItem({ id: 8, documentNumber: "PV-2026-015", documentName: "설비 밸리데이션 보고서", relevanceScore: 200 })
  ];
  const serverHtml = serverResultsBody(await renderServer(dominantServer, query, 2));
  const browser = await renderBrowser(dominantBrowser, query);
  assert.doesNotMatch(serverHtml, /data-answer-card|rest-label/);
  assert.doesNotMatch(browser.html, /data-answer-card|rest-label/);
  assert.equal((serverHtml.match(/viewer-result-row/g) || []).length, 2);
  assert.equal((browser.html.match(/viewer-result-row/g) || []).length, 2);

  const ambiguousServer = serverResultsBody(await renderServer([
    serverItem({ relevanceScore: 299 }),
    serverItem({ id: 8, documentNumber: "PV-2026-015", relevanceScore: 200 })
  ], query, 2));
  assert.doesNotMatch(ambiguousServer, /data-answer-card/);

  const ambiguousBrowser = await renderBrowser([
    serverItem({ relevanceScore: 200 }),
    serverItem({ id: 8, documentNumber: "PV-2026-015", relevanceScore: 200 })
  ], query);
  assert.doesNotMatch(ambiguousBrowser.html, /data-answer-card/);
  assert.match(ambiguousBrowser.html, /^<div class="viewer-result-table"/);
});

test("browser search core is loaded as a static ESM asset", () => {
  const core = createSearchCore();

  assert.equal(core.compactSearchText(" PV-2026 / 014 "), "pv2026014");
  assert.equal(core.rackFaceLabel(browserItem()), "1-1");
  assert.equal(core.decideDominantAnswer({
    query: "PV-2026-014",
    documentNumber: "PV-2026-014",
    firstScore: 500,
    resultCount: 2
  }).grade, "certain");
  assert.equal(searchCoreScript(), `<script type="module" src="/assets/search-core.js"></script>`);
});

test("dominant-answer policy keeps exact, single, threshold, and ambiguous boundaries", () => {
  const core = createSearchCore();

  assert.deepEqual(core.decideDominantAnswer({
    query: "PV-2026-014",
    documentNumber: "PV 2026/014",
    firstScore: 1,
    secondScore: 999,
    resultCount: 2
  }), { show: true, grade: "certain" });
  assert.deepEqual(core.decideDominantAnswer({
    query: "밸리데이션",
    documentNumber: "PV-2026-014",
    firstScore: 1,
    resultCount: 1
  }), { show: true, grade: "likely" });
  assert.deepEqual(core.decideDominantAnswer({
    query: "밸리데이션",
    documentNumber: "PV-2026-014",
    firstScore: 300,
    secondScore: 200,
    resultCount: 2
  }), { show: true, grade: "likely" });
  assert.deepEqual(core.decideDominantAnswer({
    query: "밸리데이션",
    documentNumber: "PV-2026-014",
    firstScore: 299,
    secondScore: 200,
    resultCount: 2
  }), { show: false, grade: "likely" });
  assert.deepEqual(core.decideDominantAnswer({
    query: "PV-2026-014",
    documentNumber: "PV-2026-014",
    firstScore: 0,
    resultCount: 1
  }), { show: false, grade: "certain" });
});
