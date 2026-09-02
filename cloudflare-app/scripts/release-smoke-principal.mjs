#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

import { createReleaseSmokeCompatibilityPasswordRecord } from "../src/auth/passwords.js";
import { preflightDeploy, runWranglerCaptured } from "./deploy-guarded.mjs";

const APP_ROOT = path.resolve(import.meta.dirname, "..");

function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function required(environment, name) {
  const value = String(environment[name] || "").trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function operationId(environment) {
  const value = required(environment, "RELEASE_SMOKE_OPERATION_ID");
  if (!/^[a-z0-9][a-z0-9._-]{7,127}$/i.test(value)) {
    throw new Error("RELEASE_SMOKE_OPERATION_ID has an invalid format.");
  }
  return value;
}

function resultRows(payload) {
  const executions = Array.isArray(payload) ? payload : [payload];
  return executions.flatMap((execution) => execution?.results || execution?.result?.results || []);
}

function resultCount(payload, field) {
  const row = resultRows(payload).findLast((candidate) => Object.hasOwn(candidate || {}, field));
  return Number(row?.[field]);
}

function parseWranglerJson(output) {
  const text = String(output || "");
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "[" && text[index] !== "{") continue;
    try {
      return JSON.parse(text.slice(index));
    } catch {
      // Wrangler may print progress text before the final JSON payload.
    }
  }
  throw new SyntaxError("Wrangler output does not contain a valid JSON payload.");
}

export function preflightSmokePrincipal({ action, environment = process.env } = {}) {
  const envName = environment.D1_PROVISION_ENV || environment.CLOUDFLARE_ENV;
  const target = preflightDeploy({
    envName,
    expectedDatabaseId: environment.D1_TARGET_DATABASE_ID,
    requireSearchDatabase: true,
    dryRun: true
  });
  const errors = target.ok ? [] : [...target.errors];
  if (!["provision", "cleanup"].includes(action)) errors.push("action must be provision or cleanup.");
  try {
    operationId(environment);
  } catch (error) {
    errors.push(error.message);
  }
  if (action === "provision" && !String(environment.RELEASE_SMOKE_CREDENTIAL_PATH || "").trim()) {
    errors.push("RELEASE_SMOKE_CREDENTIAL_PATH is required for provisioning.");
  }
  return errors.length ? { ok: false, errors } : { ok: true, action, envName, target };
}

function usernames(id) {
  const suffix = id.toLowerCase().replace(/[^a-z0-9]/g, "").slice(-32);
  return {
    reader: `release-reader-${suffix}@hanlim.internal`,
    admin: `release-admin-${suffix}@hanlim.internal`,
    demo: `release-demo-${suffix}@hanlim.internal`
  };
}

function cleanupSql() {
  return `
    DELETE FROM login_throttle
    WHERE username IN (
      SELECT username FROM app_users WHERE approved_by LIKE 'release-smoke:%'
    );
    DELETE FROM app_users WHERE approved_by LIKE 'release-smoke:%';
    SELECT changes() AS removed;
    SELECT COUNT(*) AS remaining
    FROM app_users
    WHERE approved_by LIKE 'release-smoke:%';
  `;
}

function insertSql({ actor, reader, admin, demo, readerRecord, adminRecord, demoRecord }) {
  return `
    INSERT INTO app_users (
      username, display_name, password_salt, password_hash, status,
      approved_at, approved_by, role, role_template_key, must_change_password,
      expires_at,
      can_manage_documents, can_move_documents, can_manage_disposals,
      can_manage_sets, can_manage_masters, can_manage_users, can_view_audit,
      can_apply_document_snapshots, updated_at
    ) VALUES (
      ${sqlText(reader.username)}, 'Release smoke reader',
      ${sqlText(readerRecord.salt)}, ${sqlText(readerRecord.hash)}, 'approved',
      CURRENT_TIMESTAMP, ${sqlText(actor)}, 'User', 'viewer', 0,
      datetime(CURRENT_TIMESTAMP, '+45 minutes'),
      0, 0, 0, 0, 0, 0, 0, 0, CURRENT_TIMESTAMP
    );
    INSERT INTO app_users (
      username, display_name, password_salt, password_hash, status,
      approved_at, approved_by, role, role_template_key, must_change_password,
      expires_at,
      can_manage_documents, can_move_documents, can_manage_disposals,
      can_manage_sets, can_manage_masters, can_manage_users, can_view_audit,
      can_apply_document_snapshots, updated_at
    ) VALUES (
      ${sqlText(admin.username)}, 'Release smoke manager',
      ${sqlText(adminRecord.salt)}, ${sqlText(adminRecord.hash)}, 'approved',
      CURRENT_TIMESTAMP, ${sqlText(actor)}, 'User', NULL, 0,
      datetime(CURRENT_TIMESTAMP, '+45 minutes'),
      0, 0, 0, 0, 0, 1, 0, 0, CURRENT_TIMESTAMP
    );
    INSERT INTO app_users (
      username, display_name, password_salt, password_hash, status,
      approved_at, approved_by, role, role_template_key, access_mode, must_change_password,
      expires_at,
      can_manage_documents, can_move_documents, can_manage_disposals,
      can_manage_sets, can_manage_masters, can_manage_users, can_view_audit,
      can_apply_document_snapshots, updated_at
    ) VALUES (
      ${sqlText(demo.username)}, 'Release smoke demo reviewer',
      ${sqlText(demoRecord.salt)}, ${sqlText(demoRecord.hash)}, 'approved',
      CURRENT_TIMESTAMP, ${sqlText(actor)}, 'User', 'viewer', 'demo_readonly', 0,
      datetime(CURRENT_TIMESTAMP, '+45 minutes'),
      0, 0, 0, 0, 0, 0, 0, 0, CURRENT_TIMESTAMP
    );
  `;
}

function verificationSql(actor) {
  return `
    SELECT COUNT(*) AS provisioned
    FROM app_users
    WHERE approved_by = ${sqlText(actor)} AND status = 'approved';
  `;
}

function executeSql({ databaseId, envName, sql, environment, spawn, execPath }) {
  return runWranglerCaptured({
    appRoot: APP_ROOT,
    execPath,
    spawn,
    environment,
    args: [
      "d1", "execute", databaseId,
      "--remote", "--env", envName,
      "--command", sql,
      "--json"
    ]
  });
}

export async function runSmokePrincipal({
  action,
  environment = process.env,
  spawn = spawnSync,
  execPath = process.execPath
} = {}) {
  const checked = preflightSmokePrincipal({ action, environment });
  if (!checked.ok) return checked;
  const id = operationId(environment);
  const actor = `release-smoke:${id}`;
  const names = usernames(id);

  if (action === "cleanup") {
    const cleaned = executeSql({
      databaseId: checked.target.configuredId,
      envName: checked.envName,
      sql: cleanupSql(),
      environment,
      spawn,
      execPath
    });
    if (cleaned.error || cleaned.status !== 0) {
      return { ok: false, remoteStateUnknown: true, errors: ["Release smoke principal cleanup failed."] };
    }
    let payload;
    try {
      payload = parseWranglerJson(cleaned.stdout);
    } catch {
      return { ok: false, remoteStateUnknown: true, errors: ["Release smoke cleanup response is invalid."] };
    }
    const remaining = resultCount(payload, "remaining");
    if (remaining !== 0) {
      return { ok: false, remoteStateUnknown: true, errors: ["Release smoke principals remain after cleanup."] };
    }
    return { ok: true, action, removed: resultCount(payload, "removed") };
  }

  const precleaned = executeSql({
    databaseId: checked.target.configuredId,
    envName: checked.envName,
    sql: cleanupSql(),
    environment,
    spawn,
    execPath
  });
  if (precleaned.error || precleaned.status !== 0) {
    return { ok: false, errors: ["Release smoke principal pre-cleanup failed."] };
  }
  const credentials = {
    reader: { username: names.reader, password: randomBytes(24).toString("base64url") },
    admin: { username: names.admin, password: randomBytes(24).toString("base64url") },
    demo: { username: names.demo, password: randomBytes(24).toString("base64url") }
  };
  const [readerRecord, adminRecord, demoRecord] = await Promise.all([
    createReleaseSmokeCompatibilityPasswordRecord(credentials.reader.password),
    createReleaseSmokeCompatibilityPasswordRecord(credentials.admin.password),
    createReleaseSmokeCompatibilityPasswordRecord(credentials.demo.password)
  ]);
  const directory = mkdtempSync(path.join(tmpdir(), "hanlim-release-smoke-"));
  try {
    const sqlPath = path.join(directory, "provision.sql");
    writeFileSync(sqlPath, insertSql({
      actor,
      reader: credentials.reader,
      admin: credentials.admin,
      demo: credentials.demo,
      readerRecord,
      adminRecord,
      demoRecord
    }), { encoding: "utf8", mode: 0o600 });
    const provisioned = runWranglerCaptured({
      appRoot: APP_ROOT,
      execPath,
      spawn,
      environment,
      args: [
        "d1", "execute", checked.target.configuredId,
        "--remote", "--env", checked.envName,
        "--file", sqlPath,
        "--json"
      ]
    });
    if (provisioned.error || provisioned.status !== 0) {
      return { ok: false, errors: ["Release smoke principal provisioning failed."] };
    }
    const verified = executeSql({
      databaseId: checked.target.configuredId,
      envName: checked.envName,
      sql: verificationSql(actor),
      environment,
      spawn,
      execPath
    });
    if (verified.error || verified.status !== 0) {
      await runSmokePrincipal({ action: "cleanup", environment, spawn, execPath });
      return { ok: false, errors: ["Release smoke principal verification failed."] };
    }
    let payload;
    try {
      payload = parseWranglerJson(verified.stdout);
    } catch {
      await runSmokePrincipal({ action: "cleanup", environment, spawn, execPath });
      return { ok: false, errors: ["Release smoke principal response is invalid."] };
    }
    const count = resultCount(payload, "provisioned");
    if (count !== 3) {
      await runSmokePrincipal({ action: "cleanup", environment, spawn, execPath });
      return { ok: false, errors: ["Release smoke principal verification failed."] };
    }
    const credentialPath = path.resolve(required(environment, "RELEASE_SMOKE_CREDENTIAL_PATH"));
    writeFileSync(credentialPath, `${JSON.stringify(credentials)}\n`, { encoding: "utf8", mode: 0o600 });
    return { ok: true, action, provisioned: count, credentialPath };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const actionIndex = process.argv.indexOf("--action");
  const action = actionIndex >= 0 ? process.argv[actionIndex + 1] : "";
  const result = await runSmokePrincipal({ action });
  if (!result.ok) {
    for (const error of result.errors || []) console.error(`[release-smoke-principal] ${error}`);
    process.exit(1);
  }
  console.log(JSON.stringify({
    action: `release-smoke-principal-${action}`,
    provisioned: result.provisioned || 0,
    removed: result.removed || 0
  }));
}
