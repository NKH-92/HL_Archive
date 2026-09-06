import { getAppConfig } from "../config.js";
import {
  parseDocumentFilters,
  getSearchReport,
  getSearchSuggestions,
  getViewerSearchPayload,
  recordSearchClick
} from "../domains/search/index.js";
import { buildFloorPlanLayout, getActiveRacks, getFloorPlanRegions, getRackSummaries } from "../domains/racks/index.js";
import { getDocumentSets } from "../domains/sets/index.js";
import { capabilitiesFromSession } from "../domains/identity/index.js";
import { dashboardPage, qaPage, searchReportPage } from "../views/searchViews.js";
import { floorPlanPage } from "../views/floorPlanViews.js";
import { jsonResponse } from "../platform/http/responses.js";
import { clean } from "../shared/text/normalize.js";
import { resolveSearchOutcome, resolveSearchRequest } from "./searchRequest.js";

export async function handleDashboard(request, env, session) {
  const url = new URL(request.url);
  const search = await resolveSearchRequest(env, url);
  const { query, page, categories, tags, parsed } = search;
  const filters = { ...search.filters, status: "active", includeDisposed: false };
  const selectedDocumentIds = parseSelectedDocumentIds(url.searchParams.get("selected"));
  const capabilities = capabilitiesFromSession(session);
  const [editableSets, racks, viewerSearch] = await Promise.all([
    capabilities.canManageSets ? getEditableSetsForWorkspace(env) : Promise.resolve([]),
    filters.rackId ? getActiveRacks(env) : Promise.resolve([]),
    getViewerSearchPayload(env, {
      q: parsed.text,
      category: filters.categoryId,
      zone: filters.zoneNumber,
      tag: filters.tagId,
      rack: filters.rackId,
      face: filters.rackFace,
      column: filters.columnNumber,
      shelf: filters.shelfNumber,
      status: filters.status,
      sort: filters.sort,
      page,
      pageSize: 30
    }, { includeFacets: false })
  ]);

  const totalItems = viewerSearch.pagination?.totalItems ?? viewerSearch.items?.length ?? 0;
  const didYouMean = await resolveSearchOutcome(env, search, totalItems);
  const isHome = !query && ![
    filters.categoryId, filters.tagId, filters.zoneNumber, filters.rackId,
    filters.rackFace, filters.columnNumber, filters.shelfNumber
  ].some(Boolean) && (!filters.sort || filters.sort === "updated");

  return dashboardPage({
    session,
    mode: isHome ? "home" : "results",
    query,
    parsedQuery: parsed,
    viewerSearch,
    categories,
    tags,
    racks,
    filters,
    explicitFilters: search.explicitFilters,
    didYouMean,
    editableSets,
    selectedDocumentIds
  });
}

function parseSelectedDocumentIds(value) {
  return [...new Set(clean(value).split(",")
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0))]
    .slice(0, 200);
}

async function getEditableSetsForWorkspace(env) {
  try {
    return (await getDocumentSets(env)).filter((set) => Number(set.is_locked) !== 1);
  } catch (error) {
    // Password-change compatibility tests intentionally exercise a pre-row-version
    // schema. The workspace must remain usable there, while mutations stay disabled.
    if (String(error?.message || "").includes("no such column: s.row_version")) return [];
    throw error;
  }
}

export function renderQa(session, env) {
  return qaPage({ session, support: getAppConfig(env).support });
}

export async function handleFloorPlan(env, session) {
  const [racks, regions] = await Promise.all([
    getRackSummaries(env),
    getFloorPlanRegions(env)
  ]);
  return floorPlanPage({
    session,
    floorPlan: buildFloorPlanLayout(racks, regions)
  });
}

export async function handleSearchSuggestions(request, env) {
  const url = new URL(request.url);
  const query = clean(url.searchParams.get("q"));
  const filters = parseDocumentFilters(url.searchParams, { query });
  const suggestions = filters.status === "disposed" || filters.status === "all"
    ? []
    : await getSearchSuggestions(env, query, 8);
  return jsonResponse({ suggestions });
}

export async function handleViewerSearch(request, env) {
  const url = new URL(request.url);
  if (url.searchParams.get("resolved") === "1") {
    const payload = await getViewerSearchPayload(env, Object.fromEntries(url.searchParams), { includeFacets: false });
    if (payload?.ok === false) return jsonResponse(payload, { status: Number(payload.status || 400) });
    return jsonResponse(payload);
  }
  const search = await resolveSearchRequest(env, url);
  const params = {
    ...Object.fromEntries(url.searchParams),
    q: search.parsed.text,
    category: search.filters.categoryId,
    zone: search.filters.zoneNumber,
    tag: search.filters.tagId,
    rack: search.filters.rackId,
    face: search.filters.rackFace,
    column: search.filters.columnNumber,
    shelf: search.filters.shelfNumber,
    status: search.filters.status,
    sort: search.filters.sort
  };
  const payload = await getViewerSearchPayload(env, params, { includeFacets: false });
  if (payload?.ok === false) {
    return jsonResponse(payload, { status: Number(payload.status || 400) });
  }
  return jsonResponse(payload);
}

export function handleSearchIndex() {
  return jsonResponse({
    ok: false,
    code: "SEARCH_INDEX_RETIRED",
    message: "브라우저 전체 검색 인덱스는 종료되었습니다. /api/viewer/search를 사용하세요."
  }, { status: 410, cacheControl: "private, no-store" });
}

export async function handleSearchClick(request, env) {
  const form = await request.formData();
  const result = await recordSearchClick(env, clean(form.get("q")), Number(form.get("documentId")));
  return jsonResponse(result, { status: result.ok ? 200 : 400 });
}

export async function handleAdminSearchReport(env, session) {
  const report = await getSearchReport(env);
  return searchReportPage({ session, report });
}
