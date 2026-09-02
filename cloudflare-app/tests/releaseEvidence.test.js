import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { generateReleaseEvidence } from "../scripts/generate-release-evidence.mjs";
import { runReleaseSmoke } from "../scripts/smoke-release.mjs";

test("release evidence는 migration checksum과 schema manifest를 보존한다", async (context) => {
  const target = await mkdtemp(path.join(tmpdir(), "hanlim-release-"));
  context.after(() => rm(target, { recursive: true, force: true }));
  const evidence = await generateReleaseEvidence({ outDir: target, env: { SOURCE_REVISION: "abc123", SOURCE_REF: "test" } });
  const manifest = JSON.parse(await readFile(path.join(target, "migration-manifest.json"), "utf8"));

  assert.equal(evidence.sourceRevision, "abc123");
  assert.equal(evidence.migrationCount, 60);
  assert.equal(Object.keys(manifest.checksums).length, 60);
  assert.ok(manifest.schema.tables.includes("documents"));
  assert.ok(manifest.schema.tables.includes("search_projection_documents"));
  // 0049에서 크로스 DB 보상 계층의 마지막 잔재를 제거했다.
  assert.equal(manifest.schema.tables.includes("search_index_outbox"), false);
  assert.equal(manifest.schema.tables.includes("search_event_clock"), false);
  assert.match(evidence.migrationManifestSha256, /^[a-f0-9]{64}$/);
  // 검색 색인이 Core migration 체인 안에 있으므로 별도 Search manifest 증빙을 만들지 않는다.
  assert.equal("searchMigrationCount" in evidence, false);
});

test("release smoke는 health, login, signup, 인증 검색 계약을 확인한다", async () => {
  const calls = [];
  const responses = [
    new Response('{"ok":true}', { status: 200, headers: { "Content-Type": "application/json" } }),
    new Response('<input name="username">', { status: 200 }),
    new Response("not found", { status: 404 }),
    new Response(null, { status: 302, headers: { Location: "/app?q=release-smoke", "Set-Cookie": "hanlim_session=token; Path=/" } }),
    new Response('<main data-viewer-app></main>', { status: 200 })
  ];
  const result = await runReleaseSmoke({
    baseUrl: "https://archive.example.com/",
    username: "smoke@example.com",
    password: "secret-value",
    allowedHosts: ["archive.example.com"],
    fetchImpl: async (url, options = {}) => { calls.push({ url, options }); return responses.shift(); }
  });

  assert.deepEqual(result, { health: 200, login: 200, signup: 404, search: 200, origin: "https://archive.example.com" });
  assert.equal(calls.at(-2).options.headers.Origin, "https://archive.example.com");
  assert.equal(calls.at(-1).options.headers.Cookie, "hanlim_session=token");
});

test("release smoke 로그인 실패는 상태 코드와 Cloudflare Ray를 남긴다", async () => {
  const responses = [
    new Response('{"ok":true}', { status: 200, headers: { "Content-Type": "application/json" } }),
    new Response('<input name="username">', { status: 200 }),
    new Response("not found", { status: 404 }),
    new Response("internal error", { status: 500, headers: { "CF-Ray": "test-ray" } })
  ];

  await assert.rejects(
    runReleaseSmoke({
      baseUrl: "https://archive.example.com",
      username: "smoke@example.com",
      password: "secret-value",
      allowedHosts: ["archive.example.com"],
      fetchImpl: async () => responses.shift()
    }),
    /smoke 계정 로그인 실패\(status=500, cf-ray=test-ray\)/
  );
});

test("release smoke는 Worker 배포 전파 중 health 실패를 재시도한다", async () => {
  const calls = [];
  const waits = [];
  const responses = [
    new Response("not ready", { status: 404 }),
    new Response('{"ok":true}', { status: 200, headers: { "Content-Type": "application/json" } }),
    new Response('<input name="username">', { status: 200 }),
    new Response("not found", { status: 404 }),
    new Response(null, { status: 302, headers: { Location: "/app", "Set-Cookie": "hanlim_session=token; Path=/" } }),
    new Response('<main data-viewer-app></main>', { status: 200 })
  ];

  const result = await runReleaseSmoke({
    baseUrl: "https://archive.example.com",
    username: "smoke@example.com",
    password: "secret-value",
    allowedHosts: ["archive.example.com"],
    fetchImpl: async (url) => { calls.push(url); return responses.shift(); },
    waitImpl: async (milliseconds) => { waits.push(milliseconds); }
  });

  assert.equal(result.health, 200);
  assert.equal(calls.filter((url) => url.endsWith("/healthz")).length, 2);
  assert.deepEqual(waits, [1_000]);
});
