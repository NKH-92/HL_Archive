import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDemoReviewerSql,
  DEMO_REVIEWER,
  DEMO_REVIEWER_PRODUCTION_URL,
  demoReviewerPrecheckSql,
  preflightDemoReviewer,
  verifyDemoReviewerLogin
} from "../scripts/provision-demo-reviewer-guarded.mjs";
import { createMigratedDatabase } from "./helpers/migratedDatabase.js";

const DATABASE_ID = "a07324c0-7547-48a6-836e-3f0c50b85c36";

function environment(overrides = {}) {
  return {
    CLOUDFLARE_ENV: "production",
    D1_PROVISION_ENV: "production",
    D1_TARGET_DATABASE_ID: DATABASE_ID,
    USER_PROVISION_PASSWORD: "initial-password-2026",
    DEMO_REVIEWER_CONFIRM: `PROVISION-DEMO-REVIEWER:production:${DATABASE_ID}`,
    DEMO_REVIEWER_OPERATION_ID: "github-run-30162018149",
    DEMO_REVIEWER_BASE_URL: DEMO_REVIEWER_PRODUCTION_URL,
    ...overrides
  };
}

test("시연 계정 provisioning은 고정 대상·운영 DB·기존 초기 비밀번호 secret을 검증한다", () => {
  assert.deepEqual(DEMO_REVIEWER, {
    username: "review@test.com",
    displayName: "본사 인사팀 검토",
    team: "본사 인사팀"
  });
  assert.equal(preflightDemoReviewer({ environment: environment() }).ok, true);
  assert.equal(preflightDemoReviewer({ environment: environment({ USER_PROVISION_PASSWORD: "12345" }) }).ok, false);
  assert.equal(preflightDemoReviewer({ environment: environment({ DEMO_REVIEWER_CONFIRM: "wrong" }) }).ok, false);
  assert.equal(preflightDemoReviewer({ environment: environment({ DEMO_REVIEWER_BASE_URL: "https://example.com" }) }).ok, false);
});

test("시연 계정 운영 로그인 검증은 최초 비밀번호 변경 redirect와 session cookie를 요구한다", async () => {
  let request;
  await verifyDemoReviewerLogin({
    baseUrl: DEMO_REVIEWER_PRODUCTION_URL,
    password: "initial-password-2026",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(null, {
        status: 302,
        headers: { location: "/account/password?required=1", "set-cookie": "session=test; Secure; HttpOnly" }
      });
    }
  });
  assert.equal(request.url, `${DEMO_REVIEWER_PRODUCTION_URL}/login`);
  assert.equal(request.options.redirect, "manual");
  assert.match(String(request.options.body), /username=review%40test.com/);
  await assert.rejects(() => verifyDemoReviewerLogin({
    baseUrl: DEMO_REVIEWER_PRODUCTION_URL,
    password: "initial-password-2026",
    fetchImpl: async () => new Response(null, { status: 403 })
  }));
});

test("시연 계정 생성 SQL은 실제 권한 0·전 화면 preview access mode·최초 변경·무기한을 고정한다", async () => {
  const database = await createMigratedDatabase();
  try {
    database.exec(buildDemoReviewerSql({
      passwordRecord: { salt: "test-salt", hash: "test-hash" },
      actor: "guarded-demo-reviewer:test-operation"
    }));
    const user = database.prepare("SELECT * FROM app_users WHERE username = ?").get(DEMO_REVIEWER.username);
    assert.equal(user.display_name, DEMO_REVIEWER.displayName);
    assert.equal(user.team, DEMO_REVIEWER.team);
    assert.equal(user.access_mode, "demo_readonly");
    assert.equal(user.role_template_key, "viewer");
    assert.equal(user.must_change_password, 1);
    assert.equal(user.expires_at, null);
    for (const key of [
      "can_manage_documents", "can_move_documents", "can_manage_disposals", "can_manage_sets",
      "can_manage_masters", "can_manage_users", "can_view_audit", "can_apply_document_snapshots"
    ]) assert.equal(user[key], 0);
    const state = database.prepare(demoReviewerPrecheckSql()).get();
    assert.deepEqual({ existing: state.existing_count, ready: state.ready_count }, { existing: 1, ready: 1 });
  } finally {
    database.close();
  }
});
