#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { createPasswordRecord } from "../src/auth/passwords.js";
import { validateNewPassword } from "../src/domains/identity/index.js";
import { preflightDeploy, runWranglerCaptured } from "./deploy-guarded.mjs";

export const DEMO_REVIEWER = Object.freeze({
  username: "review@test.com",
  displayName: "본사 인사팀 검토",
  team: "본사 인사팀"
});

export const DEMO_REVIEWER_PRODUCTION_URL = "https://hanlim-archive.skarhkdgus7.workers.dev";

const PERMISSION_COLUMNS = Object.freeze([
  "can_manage_documents", "can_move_documents", "can_manage_disposals", "can_manage_sets",
  "can_manage_masters", "can_manage_users", "can_view_audit", "can_apply_document_snapshots"
]);

function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function parseWranglerJson(output) {
  const text = String(output || "");
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "[" && text[index] !== "{") continue;
    try { return JSON.parse(text.slice(index)); } catch { /* Wrangler prefix */ }
  }
  throw new SyntaxError("Wrangler output does not contain JSON.");
}

function resultRows(payload) {
  const executions = Array.isArray(payload) ? payload : [payload];
  return executions.flatMap((execution) => execution?.results || execution?.result?.results || []);
}

function resultCount(payload, field) {
  const row = resultRows(payload).findLast((candidate) => Object.hasOwn(candidate || {}, field));
  return Number(row?.[field] ?? 0);
}

export function preflightDemoReviewer({ environment = process.env } = {}) {
  const envName = environment.D1_PROVISION_ENV || environment.CLOUDFLARE_ENV;
  const expectedDatabaseId = environment.D1_TARGET_DATABASE_ID;
  const target = preflightDeploy({ envName, expectedDatabaseId, dryRun: true });
  const errors = target.ok ? [] : [...target.errors];
  if (!validateNewPassword(environment.USER_PROVISION_PASSWORD).ok) {
    errors.push("USER_PROVISION_PASSWORD는 비밀번호 정책을 만족해야 합니다.");
  }
  if (environment.DEMO_REVIEWER_CONFIRM !== `PROVISION-DEMO-REVIEWER:${envName}:${expectedDatabaseId}`) {
    errors.push("DEMO_REVIEWER_CONFIRM이 대상 환경과 DB에 일치하지 않습니다.");
  }
  const operationId = String(environment.DEMO_REVIEWER_OPERATION_ID || "");
  if (!/^[a-z0-9][a-z0-9._-]{7,127}$/i.test(operationId)) {
    errors.push("DEMO_REVIEWER_OPERATION_ID 형식이 올바르지 않습니다.");
  }
  if (environment.DEMO_REVIEWER_BASE_URL !== DEMO_REVIEWER_PRODUCTION_URL) {
    errors.push("DEMO_REVIEWER_BASE_URL이 승인된 운영 주소와 일치하지 않습니다.");
  }
  return errors.length ? { ok: false, errors } : {
    ok: true, envName, databaseId: expectedDatabaseId, operationId
  };
}

export async function verifyDemoReviewerLogin({
  baseUrl,
  password,
  fetchImpl = fetch
}) {
  const body = new URLSearchParams({ username: DEMO_REVIEWER.username, password });
  const response = await fetchImpl(`${baseUrl}/login`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: baseUrl
    },
    body,
    redirect: "manual"
  });
  const location = response.headers.get("location") || "";
  const sessionCookie = response.headers.get("set-cookie") || "";
  if (![302, 303].includes(response.status)
    || !location.startsWith("/account/password")
    || !sessionCookie.includes("session=")) {
    throw new Error("시연 계정 로그인 또는 최초 비밀번호 변경 경계 검증에 실패했습니다.");
  }
}

export function demoReviewerPrecheckSql() {
  return `
    SELECT
      COUNT(*) AS existing_count,
      SUM(CASE WHEN status = 'approved'
        AND role = 'User'
        AND access_mode = 'demo_readonly'
        AND role_template_key = 'viewer'
        AND must_change_password = 1
        AND security_review_required = 0
        AND expires_at IS NULL
        AND ${PERMISSION_COLUMNS.map((column) => `${column} = 0`).join(" AND ")}
        THEN 1 ELSE 0 END) AS ready_count
    FROM app_users
    WHERE username = ${sqlText(DEMO_REVIEWER.username)};
  `;
}

export function buildDemoReviewerSql({ passwordRecord, actor }) {
  return `
    INSERT INTO app_users (
      username, display_name, team, password_salt, password_hash, status,
      approved_at, approved_by, role, role_template_key, access_mode,
      must_change_password, security_review_required, expires_at,
      ${PERMISSION_COLUMNS.join(", ")}, updated_at
    ) VALUES (
      ${sqlText(DEMO_REVIEWER.username)}, ${sqlText(DEMO_REVIEWER.displayName)}, ${sqlText(DEMO_REVIEWER.team)},
      ${sqlText(passwordRecord.salt)}, ${sqlText(passwordRecord.hash)}, 'approved',
      CURRENT_TIMESTAMP, ${sqlText(actor)}, 'User', 'viewer', 'demo_readonly',
      1, 0, NULL, ${PERMISSION_COLUMNS.map(() => "0").join(", ")}, CURRENT_TIMESTAMP
    );
  `;
}

function execute({ checked, sql, file, environment, spawn, execPath }) {
  const args = ["d1", "execute", checked.databaseId, "--remote", "--env", checked.envName];
  if (file) args.push("--file", file);
  else args.push("--command", sql);
  args.push("--json");
  return runWranglerCaptured({
    appRoot: path.resolve(import.meta.dirname, ".."), execPath, spawn, environment, args
  });
}

export async function runDemoReviewerProvision({
  environment = process.env,
  spawn = spawnSync,
  execPath = process.execPath,
  fetchImpl = fetch
} = {}) {
  const checked = preflightDemoReviewer({ environment });
  if (!checked.ok) return checked;
  const actor = `guarded-demo-reviewer:${checked.operationId}`;
  const prechecked = execute({ checked, sql: demoReviewerPrecheckSql(), environment, spawn, execPath });
  if (prechecked.status !== 0) return { ok: false, errors: ["시연 계정 사전 조회에 실패했습니다. migration 0060 적용 상태를 확인하세요."] };
  let before;
  try { before = parseWranglerJson(prechecked.stdout); } catch { return { ok: false, errors: ["시연 계정 사전 조회 결과가 불명확합니다."] }; }
  const existing = resultCount(before, "existing_count");
  const ready = resultCount(before, "ready_count");
  if (existing === 1 && ready === 1) {
    try {
      await verifyDemoReviewerLogin({
        baseUrl: environment.DEMO_REVIEWER_BASE_URL,
        password: environment.USER_PROVISION_PASSWORD,
        fetchImpl
      });
      return { ok: true, alreadyPresent: true, created: 0 };
    } catch {
      return { ok: false, errors: ["기존 시연 계정의 운영 로그인 검증에 실패했습니다."] };
    }
  }
  if (existing !== 0) {
    return { ok: false, errors: ["review@test.com이 이미 존재하지만 시연 및 조회용 정책과 일치하지 않아 변경하지 않았습니다."] };
  }

  const passwordRecord = await createPasswordRecord(environment.USER_PROVISION_PASSWORD);
  const directory = mkdtempSync(path.join(tmpdir(), "hanlim-demo-reviewer-"));
  try {
    const sqlPath = path.join(directory, "provision.sql");
    writeFileSync(sqlPath, buildDemoReviewerSql({ passwordRecord, actor }), { encoding: "utf8", mode: 0o600 });
    const provisioned = execute({ checked, file: sqlPath, environment, spawn, execPath });
    if (provisioned.status !== 0) return { ok: false, errors: ["시연 계정 생성에 실패했습니다."] };
    const verified = execute({ checked, sql: demoReviewerPrecheckSql(), environment, spawn, execPath });
    if (verified.status !== 0) return { ok: false, remoteStateUnknown: true, errors: ["시연 계정 생성 후 검증에 실패했습니다."] };
    const payload = parseWranglerJson(verified.stdout);
    if (resultCount(payload, "existing_count") !== 1 || resultCount(payload, "ready_count") !== 1) {
      return { ok: false, remoteStateUnknown: true, errors: ["시연 계정 생성 결과가 정책과 일치하지 않습니다."] };
    }
    await verifyDemoReviewerLogin({
      baseUrl: environment.DEMO_REVIEWER_BASE_URL,
      password: environment.USER_PROVISION_PASSWORD,
      fetchImpl
    });
    return { ok: true, alreadyPresent: false, created: 1 };
  } catch {
    return { ok: false, remoteStateUnknown: true, errors: ["시연 계정 원격 상태를 확인할 수 없습니다."] };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = await runDemoReviewerProvision();
  if (!result.ok) {
    for (const error of result.errors || []) console.error(`[demo-reviewer] ${error}`);
    process.exit(1);
  }
  console.log(JSON.stringify({ action: "demo-reviewer-provision", created: result.created, alreadyPresent: result.alreadyPresent }));
}
