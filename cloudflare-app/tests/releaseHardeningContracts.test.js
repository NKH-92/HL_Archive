import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  captureD1Recovery,
  preflightD1Recovery,
  validateD1RecoveryEvidence
} from "../scripts/capture-d1-recovery.mjs";
import { preflightSmokePrincipal, runSmokePrincipal } from "../scripts/release-smoke-principal.mjs";

const CORE_ID = "a07324c0-7547-48a6-836e-3f0c50b85c36";
const RELEASE_SHA = "a".repeat(40);
const CORE_BOOKMARK = `00000001-00000002-00000003-${"a".repeat(32)}`;

function productionConfig() {
  return {
    env: {
      production: {
        d1_databases: [{ binding: "DB", database_id: CORE_ID }]
      }
    }
  };
}

function releaseEnvironment(overrides = {}) {
  return {
    CLOUDFLARE_ENV: "production",
    D1_PROVISION_ENV: "production",
    D1_RECOVERY_ENV: "production",
    D1_TARGET_DATABASE_ID: CORE_ID,
    RELEASE_SMOKE_OPERATION_ID: "release-12345678-aaaaaaaaaaaa",
    RELEASE_SMOKE_CREDENTIAL_PATH: path.join(tmpdir(), "smoke.json"),
    D1_RECOVERY_EVIDENCE_PATH: path.join(tmpdir(), "d1-recovery.json"),
    GITHUB_SHA: RELEASE_SHA,
    GITHUB_RUN_ID: "12345678",
    ...overrides
  };
}

test("D1 recovery preflight binds the production Core database and release identity", () => {
  assert.equal(preflightD1Recovery({
    environment: releaseEnvironment(),
    config: productionConfig()
  }).ok, true);
  assert.equal(preflightD1Recovery({
    environment: releaseEnvironment({ D1_TARGET_DATABASE_ID: "11111111-2222-3333-4444-555555555555" }),
    config: productionConfig()
  }).ok, false);
  assert.equal(preflightD1Recovery({
    environment: releaseEnvironment({ D1_RECOVERY_SCOPE: "core-and-search" }),
    config: productionConfig()
  }).ok, false, "제거된 Search 복구 scope는 fail-closed한다");
  assert.equal(preflightD1Recovery({
    environment: releaseEnvironment({ GITHUB_SHA: "not-a-sha" }),
    config: productionConfig()
  }).ok, false);
  assert.equal(preflightD1Recovery({
    environment: releaseEnvironment({ D1_RECOVERY_EVIDENCE_PATH: "" }),
    config: productionConfig()
  }).ok, false);
});

test("수동 복구 절차는 현재 production DB binding만 대상으로 한다", () => {
  const runbook = readFileSync(new URL("../../docs/BACKUP_RESTORE.md", import.meta.url), "utf8");
  assert.match(runbook, /wrangler d1 info DB --env production/);
  assert.match(runbook, /wrangler d1 time-travel info DB --env production --json/);
  assert.match(runbook, /wrangler d1 time-travel restore DB --env production --bookmark/);
  assert.doesNotMatch(runbook, /wrangler d1 time-travel (?:info|restore) hanlim-archive\b/);
});

test("runtime-only recovery는 임시 smoke 계정이 쓰는 Core bookmark만 캡처한다", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "d1-core-recovery-test-"));
  try {
    const outputPath = path.join(directory, "recovery.json");
    const calls = [];
    const environment = releaseEnvironment({
      D1_RECOVERY_SCOPE: "core",
      D1_RECOVERY_EVIDENCE_PATH: outputPath
    });
    const result = captureD1Recovery({
      environment,
      config: productionConfig(),
      execPath: "node-runtime",
      spawn(command, args, options) {
        calls.push({ command, args, options });
        return { status: 0, stdout: JSON.stringify({ bookmark: CORE_BOOKMARK }) };
      }
    });

    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.deepEqual(Object.keys(result.evidence.databases), ["core"]);
    assert.equal(result.evidence.scope, "core");
    assert.equal(validateD1RecoveryEvidence(result.evidence, {
      envName: "production",
      coreDatabaseId: CORE_ID,
      releaseSha: RELEASE_SHA,
      runId: "12345678",
      scope: "core"
    }).ok, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("D1 recovery captures the Core Time Travel bookmark and rejects tampering", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "d1-recovery-test-"));
  try {
    const outputPath = path.join(directory, "recovery.json");
    const calls = [];
    const result = captureD1Recovery({
      environment: releaseEnvironment({ D1_RECOVERY_EVIDENCE_PATH: outputPath }),
      config: productionConfig(),
      execPath: "node-runtime",
      spawn(command, args, options) {
        calls.push({ command, args, options });
        return { status: 0, stdout: JSON.stringify({ bookmark: CORE_BOOKMARK }) };
      }
    });
    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].args.slice(-7), [
      "d1", "time-travel", "info", CORE_ID, "--env", "production", "--json"
    ]);
    assert.equal(calls[0].options.shell, false);

    const evidence = JSON.parse(await readFile(outputPath, "utf8"));
    assert.deepEqual(Object.keys(evidence.databases), ["core"]);
    assert.equal(evidence.databases.core.databaseId, CORE_ID);
    assert.equal(evidence.databases.core.bookmark, CORE_BOOKMARK);
    assert.equal(validateD1RecoveryEvidence(evidence, {
      envName: "production",
      coreDatabaseId: CORE_ID,
      releaseSha: RELEASE_SHA,
      runId: "12345678"
    }).ok, true);

    const tampered = structuredClone(evidence);
    tampered.databases.core.databaseId = "11111111-2222-3333-4444-555555555555";
    assert.equal(validateD1RecoveryEvidence(tampered, {
      envName: "production",
      coreDatabaseId: CORE_ID,
      releaseSha: RELEASE_SHA,
      runId: "12345678"
    }).ok, false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("D1 recovery fails closed on an invalid Wrangler response", () => {
  const result = captureD1Recovery({
    environment: releaseEnvironment(),
    config: productionConfig(),
    spawn() {
      return { status: 0, stdout: JSON.stringify({ bookmark: "invalid" }) };
    }
  });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /valid bookmark/);
});

test("ephemeral smoke preflight rejects implicit targets and persistent credential output", () => {
  assert.equal(preflightSmokePrincipal({
    action: "provision",
    environment: releaseEnvironment()
  }).ok, true);
  assert.equal(preflightSmokePrincipal({
    action: "provision",
    environment: releaseEnvironment({ RELEASE_SMOKE_CREDENTIAL_PATH: "" })
  }).ok, false);
  assert.equal(preflightSmokePrincipal({
    action: "cleanup",
    environment: releaseEnvironment({ RELEASE_SMOKE_CREDENTIAL_PATH: "" })
  }).ok, true);
});

test("release smoke provisioning accepts Wrangler progress text before JSON", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "release-smoke-prefix-"));
  try {
    const credentialPath = path.join(directory, "credentials.json");
    const calls = [];
    let provisionSql = "";
    const result = await runSmokePrincipal({
      action: "provision",
      environment: releaseEnvironment({
        RELEASE_SMOKE_CREDENTIAL_PATH: credentialPath
      }),
      spawn(command, args, options) {
        calls.push({ command, args, options });
        if (args.includes("--file")) {
          provisionSql = readFileSync(args.at(-2), "utf8");
          return {
            status: 0,
            stdout: `├ Checking if file needs uploading\n${JSON.stringify([{
              results: [{ "Total queries executed": 2, "Rows written": 2 }]
            }])}`
          };
        }
        const sql = args[args.indexOf("--command") + 1] || "";
        if (sql.includes("COUNT(*) AS provisioned")) {
          return {
            status: 0,
            stdout: JSON.stringify([{ results: [{ provisioned: 2 }] }])
          };
        }
        return {
          status: 0,
          stdout: JSON.stringify([{ results: [{ removed: 0 }, { remaining: 0 }] }])
        };
      }
    });
    assert.equal(result.ok, true);
    assert.equal(result.provisioned, 2);
    assert.equal(calls.length, 3);
    assert.ok(calls.every(({ args }) => args.includes(CORE_ID)));
    assert.doesNotMatch(provisionSql, /pbkdf2-sha256\$/);
    const credentials = JSON.parse(await readFile(credentialPath, "utf8"));
    assert.match(credentials.reader.username, /^release-reader-/);
    assert.ok(credentials.reader.password.length >= 6);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("release smoke 계정은 TTL과 최소 사용자관리 권한만 가지며 다음 run이 누수를 정리한다", async () => {
  const source = await readFile(new URL("../scripts/release-smoke-principal.mjs", import.meta.url), "utf8");

  assert.match(source, /DELETE FROM app_users WHERE approved_by LIKE 'release-smoke:%'/);
  assert.equal(
    [...source.matchAll(/datetime\(CURRENT_TIMESTAMP, '\+45 minutes'\)/g)].length,
    2
  );
  assert.match(
    source,
    /'Release smoke manager'[\s\S]*?'User', 0,[\s\S]*?0, 0, 0, 0, 0, 1, 0, 0, CURRENT_TIMESTAMP/
  );
  assert.doesNotMatch(source, /'Release smoke manager'[\s\S]*?'Admin'/);
});
