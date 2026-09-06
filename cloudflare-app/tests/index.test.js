import assert from "node:assert/strict";
import test from "node:test";

import worker from "../src/index.js";
import { createPasswordRecord, createSessionCookie } from "../src/auth.js";

const SESSION_SECRET = "test-session-secret-with-at-least-32-characters";

test("regular users cannot access document administration or disposal routes", async () => {
  const env = userSessionEnv();
  const user = { username: "viewer", displayName: "Viewer", role: "User" };
  const cookie = await createSessionCookie(user, env, false);
  const csrfToken = csrfFromCookie(cookie);

  const getResponse = await worker.fetch(new Request("https://archive.example.com/documents/new", {
    headers: { Cookie: cookie }
  }), env);

  const postResponse = await worker.fetch(new Request("https://archive.example.com/documents", {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: "https://archive.example.com"
    },
    body: new URLSearchParams({ csrf_token: csrfToken })
  }), env);

  const disposalGetResponse = await worker.fetch(new Request("https://archive.example.com/documents/disposal", {
    headers: { Cookie: cookie }
  }), env);

  const disposalPostResponse = await worker.fetch(new Request("https://archive.example.com/documents/dispose-filtered", {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: "https://archive.example.com"
    },
    body: new URLSearchParams({
      csrf_token: csrfToken,
      categoryId: "1",
      reason: "test"
    })
  }), env);

  assert.equal(getResponse.status, 403);
  assert.equal(postResponse.status, 403);
  assert.equal(disposalGetResponse.status, 403);
  assert.equal(disposalPostResponse.status, 403);
});

test("root redirects every authenticated role to the search home", async () => {
  for (const role of ["User", "Admin"]) {
    const env = userSessionEnv(role);
    const cookie = await createSessionCookie({ username: role.toLowerCase(), displayName: role, role }, env, false);
    const response = await worker.fetch(new Request("https://archive.example.com/", {
      headers: { Cookie: cookie }
    }), env);

    assert.equal(response.status, 302);
    assert.equal(response.headers.get("Location"), "/app");
  }
});

test("viewer search api returns paginated items and suggestions without unused facets", async () => {
  const env = viewerSearchEnv();
  const user = { username: "viewer", displayName: "Viewer", role: "User" };
  const cookie = await createSessionCookie(user, env, false);

  const response = await worker.fetch(new Request("https://archive.example.com/api/viewer/search?q=PV&pageSize=1", {
    headers: {
      Cookie: cookie,
      Accept: "application/json"
    }
  }), env);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0].documentNumber, "PV-2026-014");
  assert.equal("storageCode" in payload.items[0], false);
  assert.equal(payload.items[0].location.label, "1구역 / 1-1번 랙 / 2열 / 3선반");
  assert.equal(payload.items[0].location.rackLabel, "1-1");
  assert.equal(payload.pagination.totalItems, 1);
  assert.equal("facets" in payload, false);
  assert.ok(payload.suggestions.length >= 1);
});

test("viewer search api applies the same natural-language filters as the server-rendered page", async () => {
  const env = viewerSearchEnv({ categories: true });
  const cookie = await createSessionCookie({ username: "viewer", displayName: "Viewer", role: "User" }, env, false);
  const response = await worker.fetch(new Request(
    "https://archive.example.com/api/viewer/search?q=" + encodeURIComponent("1구역 PV") + "&limit=30",
    { headers: { Cookie: cookie, Accept: "application/json" } }
  ), env);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0].documentNumber, "PV-2026-014");
  assert.equal(payload.candidateCount, null, "자동 인식 필터가 남은 검색어 없는 필터 전용 경로를 사용한다");
  assert.ok(env.state.calls.some((call) =>
    call.sql.includes("d.category_id = ?") &&
    call.sql.includes("r.zone_number = ?") &&
    call.args.includes(1)
  ));
});

test("resolved viewer search skips repeated category and tag reference reads", async () => {
  const env = viewerSearchEnv({ categories: true });
  const cookie = await createSessionCookie({ username: "viewer", displayName: "Viewer", role: "User" }, env, false);
  const response = await worker.fetch(new Request(
    "https://archive.example.com/api/viewer/search?resolved=1&q=&category=1&zone=1&limit=30",
    { headers: { Cookie: cookie, Accept: "application/json" } }
  ), env);
  assert.equal(response.status, 200);
  assert.equal(env.state.calls.some((call) => /FROM categories|FROM tags/.test(call.sql)), false);
});

test("disposed suggestion requests never expose active-document suggestions", async () => {
  const env = viewerSearchEnv();
  const user = { username: "viewer", displayName: "Viewer", role: "User" };
  const cookie = await createSessionCookie(user, env, false);

  const response = await worker.fetch(new Request("https://archive.example.com/api/search-suggestions?q=PV&status=disposed", {
    headers: { Cookie: cookie, Accept: "application/json" }
  }), env);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.suggestions, []);
});

test("일반 dashboard는 상태 파라미터와 무관하게 보관중 문서만 표시한다", async () => {
  const user = { username: "viewer", displayName: "Viewer", role: "User" };

  const homeEnv = dashboardSearchEnv();
  const homeCookie = await createSessionCookie(user, homeEnv, false);
  const homeResponse = await worker.fetch(new Request("https://archive.example.com/app", {
    headers: { Cookie: homeCookie }
  }), homeEnv);
  const homeHtml = await homeResponse.text();
  const homeSearch = authoritativeDocumentSearch(homeEnv.state.calls);
  assert.ok(homeSearch, "초기 /app도 서버에서 기본 문서 목록을 읽어야 한다");
  assert.ok(homeSearch.args.includes(31), "초기 문서 목록은 30행과 다음 페이지 sentinel 1행을 읽어야 한다");
  assert.equal(
    homeEnv.state.calls.some((call) => call.sql.includes("SELECT generation FROM search_projection_state")),
    true,
    "서버 조회와 cursor를 브라우저가 재사용하므로 generation을 함께 읽어야 한다"
  );
  const initialResults = JSON.parse(homeHtml.match(/<script[^>]*data-viewer-context[^>]*>([\s\S]*?)<\/script>/)[1]).initialResults;
  assert.ok(initialResults.indexGeneration >= 1);
  assert.ok(Array.isArray(initialResults.items));
  assert.ok(Object.hasOwn(initialResults, "nextCursor"));
  assert.doesNotMatch(homeHtml, /<select name="status"/);
  assert.match(homeHtml, /<option value="updated" selected>최신순<\/option>/);
  assert.match(homeHtml, /충전 공정 밸리데이션 보고서/);

  const defaultEnv = dashboardSearchEnv();
  const defaultCookie = await createSessionCookie(user, defaultEnv, false);
  const defaultResponse = await worker.fetch(new Request("https://archive.example.com/app?q=PV", {
    headers: { Cookie: defaultCookie }
  }), defaultEnv);
  const defaultHtml = await defaultResponse.text();
  const defaultSearch = authoritativeDocumentSearch(defaultEnv.state.calls);

  assert.equal(defaultResponse.status, 200);
  assert.ok(defaultSearch);
  assert.match(defaultSearch.sql, /d\.status = \?/);
  assert.equal(defaultSearch.args[0], "active");
  assert.doesNotMatch(defaultHtml, /<select name="status"/);
  assert.doesNotMatch(defaultHtml, /폐기된 공정 밸리데이션 보고서/);

  const disposedEnv = dashboardSearchEnv();
  const disposedCookie = await createSessionCookie(user, disposedEnv, false);
  const disposedResponse = await worker.fetch(new Request("https://archive.example.com/app?q=PV&status=disposed", {
    headers: { Cookie: disposedCookie }
  }), disposedEnv);
  const disposedHtml = await disposedResponse.text();
  const disposedSearch = authoritativeDocumentSearch(disposedEnv.state.calls);

  assert.equal(disposedResponse.status, 200);
  assert.ok(disposedSearch);
  assert.match(disposedSearch.sql, /d\.status = \?/);
  assert.equal(disposedSearch.args[0], "active");
  assert.doesNotMatch(disposedHtml, /폐기된 공정 밸리데이션 보고서/);
  assert.match(disposedHtml, />충전 공정 밸리데이션 보고서</);

  const legacyEnv = dashboardSearchEnv();
  const legacyCookie = await createSessionCookie(user, legacyEnv, false);
  const legacyResponse = await worker.fetch(new Request("https://archive.example.com/app?q=PV&includeDisposed=1", {
    headers: { Cookie: legacyCookie }
  }), legacyEnv);
  const legacyHtml = await legacyResponse.text();
  const legacySearch = authoritativeDocumentSearch(legacyEnv.state.calls);

  assert.equal(legacyResponse.status, 200);
  assert.ok(legacySearch);
  assert.match(legacySearch.sql, /d\.status = \?/);
  assert.equal(legacySearch.args[0], "active");
  assert.doesNotMatch(legacyHtml, /폐기된 공정 밸리데이션 보고서/);
  assert.match(legacyHtml, />충전 공정 밸리데이션 보고서</);

  const allEnv = dashboardSearchEnv();
  const allCookie = await createSessionCookie(user, allEnv, false);
  const allResponse = await worker.fetch(new Request("https://archive.example.com/app?q=PV&status=all", {
    headers: { Cookie: allCookie }
  }), allEnv);
  const allHtml = await allResponse.text();
  const allSearch = authoritativeDocumentSearch(allEnv.state.calls);

  assert.equal(allResponse.status, 200);
  assert.ok(allSearch);
  assert.match(allSearch.sql, /d\.status = \?/);
  assert.equal(allSearch.args[0], "active");
  assert.match(allHtml, /충전 공정 밸리데이션 보고서/);
  assert.doesNotMatch(allHtml, /폐기된 공정 밸리데이션 보고서/);
});

test("every authenticated role can open the dedicated floor plan", async () => {
  for (const role of ["User", "Admin"]) {
    const env = floorPlanEnv(role);
    const cookie = await createSessionCookie({ username: role.toLowerCase(), displayName: role, role }, env, false);
    const response = await worker.fetch(new Request("https://archive.example.com/floor-plan", {
      headers: { Cookie: cookie }
    }), env);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /<h1>문서고 도면<\/h1>/);
    assert.match(html, /src="\/images\/Archive\.png"/);
    assert.match(html, /href="\/app\?rack=3&amp;status=active&amp;sort=location"/);
  }
});

test("bulk disposal redirect preserves filters and reports disposed and skipped counts", async () => {
  const env = bulkDisposalEnv();
  const user = { username: "admin", displayName: "관리자", role: "Admin" };
  const cookie = await createSessionCookie(user, env, false);
  const csrfToken = csrfFromCookie(cookie);

  const response = await worker.fetch(new Request("https://archive.example.com/documents/bulk-dispose", {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: "https://archive.example.com"
    },
    body: new URLSearchParams({
      csrf_token: csrfToken,
      ids: "1,2",
      reason: "보존기간 만료",
      confirmedTargetCount: "2",
      confirmDisposal: "1",
      returnTo: "/documents/disposal?category=3&rack=9&disposalDueYear=2031"
    })
  }), env);

  assert.equal(response.status, 302);
  assert.equal(
    response.headers.get("Location"),
    "/documents/disposal?category=3&rack=9&disposalDueYear=2031&toast=bulk-disposed&disposed=1&skipped=1"
  );
  assert.equal(env.state.batches.length, 1);
  assert.equal(env.state.batches[0].filter((statement) => statement.sql.includes("UPDATE documents")).length, 1);
});

test("직접 소량 폐기는 누락되거나 불일치한 건수 확인을 mutation 전에 거부한다", async () => {
  const cases = [
    { confirmedTargetCount: "2", confirmDisposal: "" },
    { confirmedTargetCount: "1", confirmDisposal: "1" }
  ];

  for (const confirmation of cases) {
    const env = bulkDisposalEnv();
    const user = { username: "admin", displayName: "관리자", role: "Admin" };
    const cookie = await createSessionCookie(user, env, false);
    const csrfToken = csrfFromCookie(cookie);
    const response = await worker.fetch(new Request("https://archive.example.com/documents/bulk-dispose", {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: "https://archive.example.com"
      },
      body: new URLSearchParams({
        csrf_token: csrfToken,
        ids: "1,2",
        reason: "보존기간 만료",
        returnTo: "/documents/disposal",
        ...confirmation
      })
    }), env);
    const html = await response.text();

    assert.equal(response.status, 409);
    assert.match(html, /현재 선택한 폐기 대상은 2건입니다/);
    assert.equal(env.state.batches.length, 0);
  }
});

test("기존 CSV 추가 등록 경로는 닫고 엑셀 전체 동기화 경로만 사용한다", async () => {
  const env = adminImportEnv();
  const user = { username: "admin", displayName: "관리자", role: "Admin" };
  const cookie = await createSessionCookie(user, env, false);
  const csrfToken = csrfFromCookie(cookie);

  const response = await worker.fetch(new Request("https://archive.example.com/documents/import", {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: "https://archive.example.com"
    },
    body: new URLSearchParams({
      csrf_token: csrfToken,
      csvText: [
        "documentNumber,revisionNumber,documentName,category,rackCode,rackColumn,shelfNumber,rackFace",
        "DOC-1,Rev.0,문서,비활성분류,1-01,1,1,1"
      ].join("\n")
    })
  }), env);

  assert.equal(response.status, 404);
  assert.ok(!env.state.sql.some((sql) => sql.includes("INSERT INTO documents")));
});

test("locked accounts are redirected with a lock message and no new failure is recorded", async () => {
  const env = loginThrottleEnv({ locked: true });

  const response = await worker.fetch(loginRequest("someone", "wrong-password"), env);

  assert.equal(response.status, 302);
  assert.match(response.headers.get("Location"), /error=locked/);
  assert.ok(!env.state.runs.some((sql) => sql.includes("INSERT INTO login_throttle")));
});

test("failed logins record a throttle failure", async () => {
  const env = loginThrottleEnv({ locked: false, user: null });

  const response = await worker.fetch(loginRequest("someone", "wrong-password"), env);

  assert.equal(response.status, 302);
  assert.match(response.headers.get("Location"), /error=1/);
  assert.equal(env.state.batches.length, 1);
  assert.equal(env.state.batches[0].length, 4);
  assert.ok(env.state.batches[0].every((sql) => sql.includes("INSERT INTO login_throttle_v2")));
  assert.equal(
    env.state.runs.filter((sql) => sql.includes("INSERT INTO login_throttle_v2")).length,
    4
  );
});

test("successful logins clear recorded failures", async () => {
  const record = await createPasswordRecord("correct-password");
  const env = loginThrottleEnv({
    locked: false,
    user: {
      username: "someone",
      display_name: "사용자",
      password_salt: record.salt,
      password_hash: record.hash,
      status: "approved",
      role: "User"
    }
  });

  const response = await worker.fetch(loginRequest("someone", "correct-password"), env);

  assert.equal(response.status, 302);
  assert.equal(response.headers.get("Location"), "/app");
  assert.ok(env.state.runs.some((sql) => sql.includes("DELETE FROM login_throttle")));

  const adminEnv = loginThrottleEnv({
    locked: false,
    user: {
      username: "admin",
      display_name: "관리자",
      password_salt: record.salt,
      password_hash: record.hash,
      status: "approved",
      role: "Admin"
    }
  });
  const adminResponse = await worker.fetch(loginRequest("admin", "correct-password"), adminEnv);
  assert.equal(adminResponse.status, 302);
  assert.equal(adminResponse.headers.get("Location"), "/app");
});

function loginRequest(username, password) {
  return new Request("https://archive.example.com/login", {
    method: "POST",
    headers: { Origin: "https://archive.example.com" },
    body: new URLSearchParams({ username, password })
  });
}

function loginThrottleEnv({ locked, user = null }) {
  const state = { runs: [], batches: [] };

  return {
    SESSION_SECRET,
    state,
    DB: {
      prepare(sql) {
        return statement(sql);
      },
      async batch(statements) {
        state.batches.push(statements.map(({ sql }) => sql));
        return Promise.all(statements.map((item) => item.run()));
      }
    }
  };

  function statement(sql, args = []) {
    return {
      sql,
      args,
      bind(...nextArgs) {
        return statement(sql, nextArgs);
      },
      async first() {
        if (sql.includes("FROM login_throttle")) {
          return locked ? { locked_until: "2999-01-01 00:00:00" } : null;
        }
        if (sql.includes("FROM app_users")) {
          return user;
        }
        return null;
      },
      async all() {
        return { results: [] };
      },
      async run() {
        state.runs.push(sql);
        return { meta: { changes: 1 } };
      }
    };
  }
}

function bulkDisposalEnv() {
  const state = { batches: [] };
  const activeDocument = {
    id: 1,
    storage_code: "ARC-000001",
    category_id: 3,
    category_name: "PV",
    document_number: "PV-2026-001",
    revision_number: "Rev.0",
    revision_date: "2026-01-01",
    disposal_due_year: 2031,
    document_name: "폐기 대상 문서",
    note: "",
    rack_slot_id: 1,
    rack_face: "A",
    status: "active",
    updated_at: "2026-07-17 00:00:00",
    rack_code: "1-01",
    zone_number: 1,
    rack_number: 1,
    is_single_sided: 0,
    column_count: 7,
    shelf_count: 6,
    column_number: 1,
    shelf_number: 1,
    slot_code: "1-1"
  };
  const disposedDocument = { ...activeDocument, id: 2, storage_code: "ARC-000002", status: "disposed" };

  function statement(sql, args = []) {
    const methods = {
      sql,
      args,
      bind(...nextArgs) {
        return statement(sql, nextArgs);
      },
      async first() {
        if (sql.includes("FROM app_users")) {
          return { username: "admin", display_name: "관리자", status: "approved", role: "Admin" };
        }
        return null;
      },
      async all() {
        if (sql.includes("WHERE d.id IN")) {
          return { results: [{ ...activeDocument }, { ...disposedDocument }] };
        }
        if (sql.includes("FROM document_tags")) {
          return { results: [] };
        }
        return { results: [] };
      },
      async run() {
        return { meta: { changes: 1 } };
      }
    };
    return methods;
  }

  return {
    SESSION_SECRET,
    state,
    DB: {
      prepare(sql) {
        return statement(sql);
      },
      async batch(statements) {
        state.batches.push(statements);
        return statements.map(() => ({ meta: { changes: 1 } }));
      }
    }
  };
}

function adminImportEnv() {
  const state = { sql: [] };

  function resultsFor(sql) {
    if (sql.includes("FROM rack_slots")) {
      return [{
        id: 30,
        slot_code: "1-1",
        column_number: 1,
        shelf_number: 1,
        code: "1-01",
        zone_number: 1,
        rack_number: 1,
        is_single_sided: 0
      }];
    }
    return [];
  }

  return {
    SESSION_SECRET,
    state,
    DB: {
      prepare(sql) {
        state.sql.push(sql);
        const methods = {
          async first() {
            if (sql.includes("FROM app_users")) {
              return {
                username: "admin",
                display_name: "관리자",
                status: "approved",
                role: "Admin"
              };
            }
            return null;
          },
          async all() {
            return { results: resultsFor(sql) };
          },
          async run() {
            return { meta: { changes: 1 } };
          }
        };
        return {
          ...methods,
          bind() {
            return methods;
          }
        };
      }
    }
  };
}

function userSessionEnv(role = "User") {
  return {
    SESSION_SECRET,
    DB: {
      prepare() {
        return {
          bind(username) {
            return {
              async first() {
                return {
                  username,
                  display_name: role === "Admin" ? "관리자" : "Viewer",
                  status: "approved",
                  role
                };
              }
            };
          }
        };
      }
    }
  };
}

function viewerSearchEnv({ categories = false } = {}) {
  const state = { calls: [] };
  const documents = [{
    id: 7,
    storage_code: "ARC-000007",
    document_number: "PV-2026-014",
    revision_number: "Rev.1",
    document_name: "충전 공정 밸리데이션 보고서",
    note: "",
    rack_face: "A",
    status: "active",
    updated_at: "2026-06-28",
    category_name: "PV",
    category_id: 1,
    rack_code: "1-01",
    zone_number: 1,
    rack_number: 1,
    is_single_sided: 0,
    column_count: 3,
    shelf_count: 4,
    column_number: 2,
    shelf_number: 3,
    slot_code: "2-3",
    tag_names: "중요문서"
  }];

  return {
    SESSION_SECRET,
    state,
    DB: {
      prepare(sql) {
        return {
          async first() {
            state.calls.push({ type: "first", sql, args: [] });
            if (sql.includes("SELECT generation FROM search_projection_state")) return { generation: 1 };
            return null;
          },
          bind(...args) {
            return {
              async first() {
                state.calls.push({ type: "first", sql, args });
                if (sql.includes("FROM app_users")) {
                  return {
                    username: args[0],
                    display_name: "Viewer",
                    status: "approved",
                    role: "User"
                  };
                }
                return null;
              },
              async all() {
                state.calls.push({ type: "all", sql, args });
                if (sql.includes("FROM documents d")) {
                  return { results: documents };
                }
                return { results: [] };
              }
            };
          },
          async all() {
            state.calls.push({ type: "all", sql, args: [] });
            if (categories && sql.includes("FROM categories")) return { results: [{ id: 1, name: "PV" }] };
            return { results: [] };
          }
        };
      }
    }
  };
}

function floorPlanEnv(role = "User") {
  return {
    SESSION_SECRET,
    DB: {
      prepare(sql) {
        const execution = {
          async first() {
            if (sql.includes("FROM app_users")) {
              return {
                username: role.toLowerCase(),
                display_name: role,
                status: "approved",
                role
              };
            }
            return null;
          },
          async all() {
            if (sql.includes("FROM floor_plan_regions")) {
              return { results: [{
                region_key: "zone-1",
                label: "1구역",
                description: "좌상단 문서 보관 구역",
                top_pct: 3.2,
                left_pct: 4.7,
                width_pct: 47.5,
                height_pct: 38.2,
                default_rack_count: 13,
                is_active: 1
              }] };
            }
            if (sql.includes("FROM racks r")) {
              return { results: [{
                id: 3,
                zone_number: 1,
                rack_number: 3,
                code: "1-03",
                is_single_sided: 0,
                is_active: 1,
                column_count: 7,
                shelf_count: 6,
                document_count: 2,
                active_document_count: 2
              }] };
            }
            return { results: [] };
          }
        };
        return {
          ...execution,
          bind() { return execution; }
        };
      }
    }
  };
}

function dashboardSearchEnv() {
  const state = { calls: [] };
  const document = {
    id: 7,
    storage_code: "ARC-000007",
    document_number: "PV-2026-014",
    revision_number: "Rev.1",
    revision_date: "2026-04-14",
    disposal_due_year: 2031,
    document_name: "충전 공정 밸리데이션 보고서",
    note: "",
    rack_face: "A",
    status: "active",
    updated_at: "2026-06-28",
    category_name: "PV",
    category_id: 1,
    rack_code: "1-01",
    zone_number: 1,
    rack_number: 1,
    is_single_sided: 0,
    column_count: 3,
    shelf_count: 4,
    column_number: 2,
    shelf_number: 3,
    slot_code: "2-3",
    tag_names: "중요문서"
  };
  const disposedDocument = {
    ...document,
    id: 8,
    storage_code: "ARC-000008",
    document_number: "PV-2025-008",
    document_name: "폐기된 공정 밸리데이션 보고서",
    status: "disposed",
    updated_at: "2026-06-29"
  };

  return {
    SESSION_SECRET,
    state,
    DB: {
      prepare(sql) {
        const execution = (args = []) => ({
          async first() {
            state.calls.push({ type: "first", sql, args });
            if (sql.includes("FROM app_users")) {
              return {
                username: "viewer",
                display_name: "Viewer",
                status: "approved",
                role: "User"
              };
            }
            return null;
          },
          async all() {
            state.calls.push({ type: "all", sql, args });
            if (sql.includes("FROM documents d") && sql.includes("LIMIT ?")) {
              return {
                results: args.includes("disposed")
                  ? [{ ...disposedDocument }]
                  : args.includes("active")
                    ? [{ ...document }]
                    : [{ ...document }, { ...disposedDocument }]
              };
            }
            return { results: [] };
          },
          async run() {
            state.calls.push({ type: "run", sql, args });
            return { meta: { changes: 1 } };
          }
        });
        return {
          ...execution(),
          bind(...args) {
            return execution(args);
          }
        };
      }
    }
  };
}

function authoritativeDocumentSearch(calls) {
  return calls.find((call) =>
    call.type === "all" &&
    call.sql.includes("FROM documents d") &&
    call.sql.includes("ORDER BY d.updated_at DESC, d.id DESC") &&
    call.sql.includes("LIMIT ?")
  );
}

function csrfFromCookie(cookie) {
  const value = cookie.match(/hanlim_session=([^;]+)/)[1];
  const [payload] = value.split(".", 1);
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).csrfToken;
}
