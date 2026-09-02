import assert from "node:assert/strict";
import test from "node:test";

import { AUTHENTICATED_ROUTES, resolveAuthenticatedRoute } from "../src/app/routeRegistry.js";
import { secureHtmlDocument } from "../src/platform/web/htmlSecurity.js";
import {
  ACCESS_MODES,
  hasPermission,
  hasReadPermission,
  isDemoReadOnly,
  PERMISSION_KEYS,
  PERMISSIONS
} from "../src/permissions.js";
import { createMigratedDatabase } from "./helpers/migratedDatabase.js";

test("시연 access mode는 업무 권한과 분리되고 허용된 GET에서만 read guard를 통과한다", () => {
  const demo = {
    role: "Admin",
    accessMode: ACCESS_MODES.DEMO_READONLY,
    can_manage_documents: 1
  };
  assert.equal(isDemoReadOnly(demo), true);
  assert.equal(hasPermission(demo, PERMISSIONS.MANAGE_DOCUMENTS), false);
  assert.equal(hasReadPermission(demo, PERMISSIONS.MANAGE_DOCUMENTS), false);
  assert.equal(hasReadPermission({ ...demo, demoReadAuthorized: true }, PERMISSIONS.MANAGE_DOCUMENTS), true);
});

test("라우트 카탈로그는 모든 인증 경로의 시연 접근을 명시하고 export/raw GET을 차단한다", () => {
  assert.ok(AUTHENTICATED_ROUTES.every((route) => ["screen", "interactive-read", "blocked", "forced-password", "logout"].includes(route.demoAccess)));
  const blocked = [
    ["/documents/export.csv", "documents.export"],
    ["/api/document-snapshot/export", "documents.snapshot.export"],
    ["/document-snapshot-exports/demo/rows", "documents.snapshot.export.rows"],
    ["/sets/3/export.csv", "sets.export.csv"],
    ["/disposal-batches/3/export.csv", "disposal.export"],
    ["/document-import-jobs/3/failures.csv", "imports.failures"],
    ["/api/search-index", "search.index"]
  ];
  for (const [path, id] of blocked) {
    const descriptor = resolveAuthenticatedRoute(path, "GET")?.descriptor;
    assert.equal(descriptor?.id, id);
    assert.equal(descriptor?.demoAccess, "blocked");
  }
  assert.equal(resolveAuthenticatedRoute("/admin/users/new", "GET")?.descriptor.demoAccess, "screen");
  assert.equal(resolveAuthenticatedRoute("/api/viewer/search", "GET")?.descriptor.demoAccess, "interactive-read");
});

test("시연 HTML은 업무 POST form을 inert 처리하고 로그아웃·최초 비밀번호 변경만 남긴다", () => {
  const html = secureHtmlDocument(`
    <form method="post" action="/documents"><button>저장</button></form>
    <form method="post" action="/logout"><button>로그아웃</button></form>
    <form method="post" action="/account/password"><button>변경</button></form>
    <a href="/documents/export.csv">내보내기</a>
  `, { nonce: "nonce", csrfToken: "csrf", demoReadOnly: true, mustChangePassword: true });
  assert.match(html, /action="\/documents"[^>]*inert[^>]*data-demo-disabled/);
  assert.doesNotMatch(html, /action="\/logout"[^>]*inert/);
  assert.doesNotMatch(html, /action="\/account\/password"[^>]*inert/);
  assert.match(html, /href="\/documents\/export\.csv"[^>]*hidden[^>]*data-demo-blocked-download/);

  const afterChange = secureHtmlDocument('<form method="post" action="/account/password"></form>', {
    nonce: "nonce", csrfToken: "csrf", demoReadOnly: true, mustChangePassword: false
  });
  assert.match(afterChange, /data-demo-disabled/);
});

test("DB guard는 시연 계정의 권한 승격과 access mode 해제를 거부한다", async () => {
  const database = await createMigratedDatabase();
  try {
    const columns = PERMISSION_KEYS.join(", ");
    database.prepare(`
      INSERT INTO app_users (
        username, display_name, password_salt, password_hash, status, role, role_template_key,
        access_mode, must_change_password, security_review_required, ${columns}
      ) VALUES (?, ?, 'salt', 'hash', 'approved', 'User', 'viewer', 'demo_readonly', 1, 0, ${PERMISSION_KEYS.map(() => "0").join(", ")})
    `).run("review@test.com", "본사 인사팀 검토");
    assert.throws(() => database.prepare("UPDATE app_users SET can_manage_documents = 1 WHERE username = ?").run("review@test.com"), /DEMO_READONLY_POLICY_VIOLATION/);
    assert.throws(() => database.prepare("UPDATE app_users SET access_mode = 'standard' WHERE username = ?").run("review@test.com"), /DEMO_READONLY_POLICY_VIOLATION/);
    database.prepare(`
      INSERT INTO app_users (username, display_name, password_salt, password_hash, status, role, access_mode)
      VALUES ('ordinary@test.com', '일반 사용자', 'salt', 'hash', 'approved', 'User', 'standard')
    `).run();
    assert.throws(() => database.prepare("UPDATE app_users SET access_mode = 'demo_readonly' WHERE username = 'ordinary@test.com'").run(), /DEMO_READONLY_POLICY_VIOLATION/);
    database.prepare("UPDATE app_users SET status = 'disabled', session_epoch = session_epoch + 1 WHERE username = ?").run("review@test.com");
    assert.equal(database.prepare("SELECT status FROM app_users WHERE username = ?").get("review@test.com").status, "disabled");
  } finally {
    database.close();
  }
});
