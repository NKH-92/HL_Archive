import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

import { urlFor } from "../src/app/routeRegistry.js";

const HEALTH_ATTEMPTS = 15;
const HEALTH_RETRY_MS = 1_000;
const MAX_HEALTH_ATTEMPTS = 120;
const MAX_HEALTH_RETRY_MS = 5_000;
const ASSET_ATTEMPTS = 15;
const ASSET_RETRY_MS = 1_000;
const MAX_ASSET_ATTEMPTS = 60;
const MAX_ASSET_RETRY_MS = 5_000;
export const ADMIN_SMOKE_PATH = urlFor("admin.settings");
const ADMIN_SETTINGS_MARKERS = Object.freeze([
  "<h1>사용자 관리</h1>",
  "가입 요청",
  "승인된 사용자"
]);
const PUBLIC_ASSET_CONTRACTS = Object.freeze([
  Object.freeze({ path: "/assets/app.css", contentType: "text/css" }),
  Object.freeze({ path: "/assets/app.js", contentType: "text/javascript" }),
  Object.freeze({ path: "/assets/excel-app.js", contentType: "text/javascript" }),
  Object.freeze({ path: "/images/hanlim-pharm-logo.svg", contentType: "image/svg+xml" })
]);
const PUBLIC_ASSET_SECURITY_HEADERS = Object.freeze({
  "Cache-Control": "public, max-age=0, must-revalidate",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Referrer-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow"
});

/**
 * smoke credential을 읽거나 전송하기 전에 대상 URL을 검증한다.
 * loopback만 http 허용, 그 외는 https + exact hostname allowlist.
 */
export function resolveSmokeTarget(baseUrl, {
  allowedHosts = defaultAllowedHosts()
} = {}) {
  const raw = String(baseUrl || "").trim();
  if (!raw) throw new Error("SMOKE_BASE_URL이 필요합니다.");

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("SMOKE_BASE_URL이 올바른 URL이 아닙니다.");
  }

  if (parsed.username || parsed.password) {
    throw new Error("SMOKE_BASE_URL에 사용자 정보를 포함할 수 없습니다.");
  }
  if (parsed.search || parsed.hash) {
    throw new Error("SMOKE_BASE_URL은 query/hash 없이 origin만 허용합니다.");
  }

  const pathname = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "");
  if (pathname) {
    throw new Error("SMOKE_BASE_URL은 path 없는 origin만 허용합니다.");
  }

  const hostname = parsed.hostname.toLowerCase();
  const isLoopback = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
  if (isLoopback) {
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("loopback smoke URL은 http 또는 https만 허용합니다.");
    }
  } else {
    if (parsed.protocol !== "https:") {
      throw new Error("원격 smoke URL은 https만 허용합니다.");
    }
    const allow = new Set((allowedHosts || []).map((host) => String(host).toLowerCase()).filter(Boolean));
    if (!allow.has(hostname)) {
      throw new Error(`SMOKE_BASE_URL host가 allowlist에 없습니다: ${hostname}`);
    }
  }

  return Object.freeze({
    origin: parsed.origin,
    hostname,
    protocol: parsed.protocol
  });
}

function defaultAllowedHosts() {
  const raw = String(process.env.SMOKE_ALLOWED_HOSTS || "").trim();
  if (!raw) return [];
  return raw.split(",").map((part) => part.trim()).filter(Boolean);
}

export async function runReleaseSmoke({
  baseUrl,
  username,
  password,
  adminUsername = "",
  adminPassword = "",
  requireAdmin = false,
  requireSessionEpochCompatibility = false,
  requireReadiness = false,
  expectedWorkerVersion = "",
  verifyPublicSurface = false,
  publicOnly = false,
  healthAttempts = HEALTH_ATTEMPTS,
  healthRetryMs = HEALTH_RETRY_MS,
  assetAttempts = ASSET_ATTEMPTS,
  assetRetryMs = ASSET_RETRY_MS,
  allowedHosts,
  fetchImpl = fetch,
  waitImpl = wait
}) {
  // credential을 검사·전송하기 전에 URL을 먼저 검증한다.
  const target = resolveSmokeTarget(baseUrl, { allowedHosts });
  if (!publicOnly && (!username || !password)) {
    throw new Error("SMOKE_USERNAME, SMOKE_PASSWORD가 필요합니다.");
  }
  if (!publicOnly && requireAdmin && (!adminUsername || !adminPassword)) {
    throw new Error("관리자 smoke에는 SMOKE_ADMIN_USERNAME, SMOKE_ADMIN_PASSWORD가 필요합니다.");
  }

  const origin = target.origin;
  const smokeFetch = fetchImpl;
  const retryPolicy = resolveRetryPolicy({ healthAttempts, healthRetryMs, assetAttempts, assetRetryMs });
  let health;
  let healthBody = null;
  let readiness = null;
  let readinessBody = null;
  let healthOk = false;
  for (let attempt = 1; attempt <= retryPolicy.healthAttempts; attempt += 1) {
    health = await smokeFetch(`${origin}/healthz`, { redirect: "manual" });
    if (health.status === 200) {
      healthBody = await health.clone().json().catch(() => null);
      const compatibilityReady = !requireSessionEpochCompatibility
        || healthBody?.rollbackCompatibility?.sessionEpoch === 1;
      const versionReady = !expectedWorkerVersion || healthBody?.workerVersion === expectedWorkerVersion;
      if (healthBody?.ok && compatibilityReady && versionReady) {
        if (requireReadiness) {
          readiness = await smokeFetch(`${origin}/readyz`, { redirect: "manual" });
          readinessBody = await readiness.clone().json().catch(() => null);
          const readinessVersionReady = !expectedWorkerVersion
            || readinessBody?.workerVersion === expectedWorkerVersion;
          if (readiness.status === 200 && readinessBody?.ok && readinessVersionReady) {
            healthOk = true;
            break;
          }
        } else {
          healthOk = true;
          break;
        }
      }
    }
    if (attempt < retryPolicy.healthAttempts) await waitImpl(retryPolicy.healthRetryMs);
  }
  if (
    !healthOk
    && requireSessionEpochCompatibility
    && healthBody?.ok
    && healthBody?.rollbackCompatibility?.sessionEpoch !== 1
  ) {
    throw new Error("현재 Worker는 session-epoch rollback 호환성을 선언하지 않습니다. 호환 Worker를 먼저 배포하세요.");
  }
  if (
    !healthOk
    && expectedWorkerVersion
    && healthBody?.ok
    && healthBody?.workerVersion !== expectedWorkerVersion
  ) {
    const observedWorkerVersion = String(healthBody?.workerVersion || "none");
    throw new Error(
      `Worker version smoke 실패(expected=${expectedWorkerVersion}, observed=${observedWorkerVersion}, attempts=${retryPolicy.healthAttempts})`
    );
  }
  if (!healthOk && requireReadiness && healthBody?.ok) {
    throw new Error(`/readyz smoke 실패(status=${readiness?.status ?? "none"})`);
  }
  if (!healthOk) throw new Error(`/healthz smoke 실패(status=${health?.status ?? "none"})`);
  if (requireSessionEpochCompatibility && healthBody?.rollbackCompatibility?.sessionEpoch !== 1) {
    throw new Error("현재 Worker는 session-epoch rollback 호환성을 선언하지 않습니다. 호환 Worker를 먼저 배포하세요.");
  }

  let publicSurface = null;
  if (verifyPublicSurface) {
    publicSurface = await verifyReleasePublicSurface({
      target,
      fetchImpl: smokeFetch,
      waitImpl,
      assetAttempts: retryPolicy.assetAttempts,
      assetRetryMs: retryPolicy.assetRetryMs
    });
  }

  const login = await smokeFetch(`${origin}/login`, { redirect: "manual" });
  if (login.status !== 200 || !(await login.text()).includes('name="username"')) throw new Error("/login smoke 실패");

  const signup = await smokeFetch(`${origin}/signup`, { redirect: "manual" });
  if (signup.status !== 404) throw new Error("/signup 404 계약 실패");

  const summary = { health: health.status, login: login.status, signup: signup.status, origin };
  if (requireReadiness) summary.readiness = readiness.status;
  if (publicSurface) {
    summary.httpRedirect = publicSurface.httpRedirect;
    summary.assets = publicSurface.assets;
  }
  if (requireSessionEpochCompatibility) summary.sessionEpochCompatibility = 1;
  if (expectedWorkerVersion) summary.workerVersion = healthBody.workerVersion;
  if (publicOnly) return Object.freeze(summary);

  const cookie = await authenticateSmokeUser({
    origin,
    username,
    password,
    returnUrl: "/app?q=release-smoke",
    label: "smoke 계정",
    fetchImpl: smokeFetch
  });

  const search = await smokeFetch(`${origin}/app?q=release-smoke`, {
    headers: { Cookie: cookie },
    redirect: "manual"
  });
  const html = await search.text();
  if (search.status !== 200 || !html.includes("data-viewer-app")) throw new Error("인증 read-only 검색 smoke 실패");

  summary.search = search.status;
  if (requireAdmin) {
    const adminCookie = await authenticateSmokeUser({
      origin,
      username: adminUsername,
      password: adminPassword,
      returnUrl: ADMIN_SMOKE_PATH,
      label: "관리자 smoke 계정",
      fetchImpl: smokeFetch
    });
    const adminResponse = await smokeFetch(`${origin}${ADMIN_SMOKE_PATH}`, {
      headers: { Cookie: adminCookie },
      redirect: "manual"
    });
    const adminHtml = await adminResponse.text();
    if (adminResponse.status !== 200 || !ADMIN_SETTINGS_MARKERS.every((marker) => adminHtml.includes(marker))) {
      throw new Error(`관리자 설정 접근 smoke 실패(status=${adminResponse.status})`);
    }
    summary.adminSettings = adminResponse.status;
  }

  return Object.freeze(summary);
}

export async function verifyReleasePublicSurface({
  target,
  fetchImpl = fetch,
  waitImpl = wait,
  assetAttempts = ASSET_ATTEMPTS,
  assetRetryMs = ASSET_RETRY_MS,
  readExpectedAsset = readPublicAsset
}) {
  const insecure = new URL(`${target.origin}/login`);
  insecure.protocol = "http:";
  const redirectResponse = await fetchImpl(insecure.toString(), { redirect: "manual" });
  if (redirectResponse.status !== 308 || redirectResponse.headers.get("Location") !== `${target.origin}/login`) {
    throw new Error(`HTTP→HTTPS 전환 smoke 실패(status=${redirectResponse.status})`);
  }

  const assets = {};
  const retryPolicy = resolveAssetRetryPolicy({ assetAttempts, assetRetryMs });
  for (const contract of PUBLIC_ASSET_CONTRACTS) {
    const expectedBytes = toBytes(await readExpectedAsset(contract.path));
    await verifyPublicAsset({
      target,
      contract,
      expectedBytes,
      fetchImpl,
      waitImpl,
      ...retryPolicy
    });
    assets[contract.path] = 200;
  }

  return Object.freeze({
    httpRedirect: redirectResponse.status,
    assets: Object.freeze(assets)
  });
}

async function verifyPublicAsset({
  target,
  contract,
  expectedBytes,
  fetchImpl,
  waitImpl,
  assetAttempts,
  assetRetryMs
}) {
  let lastError = new Error(`정적 asset smoke 실패(path=${contract.path})`);
  for (let attempt = 1; attempt <= assetAttempts; attempt += 1) {
    const response = await fetchImpl(`${target.origin}${contract.path}`, { redirect: "manual" });
    const responseError = assetResponseError(response, contract);
    if (responseError) {
      lastError = responseError;
    } else {
      const responseBytes = new Uint8Array(await response.arrayBuffer());
      if (!sameBytes(responseBytes, expectedBytes)) {
        lastError = new Error(`정적 asset 내용 smoke 실패(path=${contract.path}, attempts=${attempt})`);
      } else {
        const etag = response.headers.get("ETag");
        if (!etag) {
          lastError = new Error(`정적 asset ETag smoke 실패(path=${contract.path}, attempts=${attempt})`);
        } else {
          const revalidated = await fetchImpl(`${target.origin}${contract.path}`, {
            headers: { "If-None-Match": etag },
            redirect: "manual"
          });
          if (revalidated.status === 304) return;
          const revalidatedError = assetResponseError(revalidated, contract);
          const revalidatedBytes = revalidatedError
            ? null
            : new Uint8Array(await revalidated.arrayBuffer());
          const stableFullResponse = !revalidatedError
            && revalidated.headers.get("ETag") === etag
            && sameBytes(revalidatedBytes, expectedBytes);
          if (stableFullResponse) return;
          lastError = new Error(`정적 asset 재검증 smoke 실패(path=${contract.path}, status=${revalidated.status}, attempts=${attempt})`);
        }
      }
    }
    if (attempt < assetAttempts) await waitImpl(assetRetryMs);
  }
  throw lastError;
}

function assetResponseError(response, contract) {
  const contentType = String(response.headers.get("Content-Type") || "").toLowerCase();
  if (response.status !== 200 || !contentType.startsWith(contract.contentType)) {
    return new Error(`정적 asset smoke 실패(path=${contract.path}, status=${response.status}, content-type=${contentType || "none"})`);
  }
  for (const [header, expected] of Object.entries(PUBLIC_ASSET_SECURITY_HEADERS)) {
    if (response.headers.get(header) !== expected) {
      return new Error(`정적 asset 보안 header smoke 실패(path=${contract.path}, header=${header})`);
    }
  }
  return null;
}

async function readPublicAsset(assetPath) {
  return readFile(new URL(`../public${assetPath}`, import.meta.url));
}

function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return new TextEncoder().encode(String(value));
}

function sameBytes(left, right) {
  if (!left || !right || left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

async function authenticateSmokeUser({ origin, username, password, returnUrl, label, fetchImpl }) {
  const form = new FormData();
  form.set("username", username);
  form.set("password", password);
  form.set("returnUrl", returnUrl);
  const authenticated = await fetchImpl(`${origin}/login`, {
    method: "POST",
    headers: { Origin: origin },
    body: form,
    redirect: "manual"
  });
  if (![302, 303].includes(authenticated.status)) {
    const ray = authenticated.headers.get("cf-ray") || "none";
    throw new Error(`${label} 로그인 실패(status=${authenticated.status}, cf-ray=${ray})`);
  }
  const location = authenticated.headers.get("location") || "";
  if (location.startsWith("/account/password")) throw new Error(`${label}은 최초 비밀번호 변경이 완료되어야 합니다.`);
  const cookie = (authenticated.headers.get("set-cookie") || "").split(";", 1)[0];
  if (!cookie) throw new Error(`${label} session cookie가 없습니다.`);
  return cookie;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function resolveRetryPolicy({ healthAttempts, healthRetryMs, assetAttempts, assetRetryMs }) {
  return Object.freeze({
    healthAttempts: boundedPositiveInteger(
      healthAttempts,
      "SMOKE_HEALTH_ATTEMPTS",
      MAX_HEALTH_ATTEMPTS
    ),
    healthRetryMs: boundedPositiveInteger(
      healthRetryMs,
      "SMOKE_HEALTH_RETRY_MS",
      MAX_HEALTH_RETRY_MS
    ),
    ...resolveAssetRetryPolicy({ assetAttempts, assetRetryMs })
  });
}

function resolveAssetRetryPolicy({ assetAttempts, assetRetryMs }) {
  return Object.freeze({
    assetAttempts: boundedPositiveInteger(
      assetAttempts,
      "SMOKE_ASSET_ATTEMPTS",
      MAX_ASSET_ATTEMPTS
    ),
    assetRetryMs: boundedPositiveInteger(
      assetRetryMs,
      "SMOKE_ASSET_RETRY_MS",
      MAX_ASSET_RETRY_MS
    )
  });
}

function boundedPositiveInteger(value, label, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${label}은 1 이상 ${maximum} 이하의 정수여야 합니다.`);
  }
  return parsed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = await runReleaseSmoke({
    baseUrl: process.env.SMOKE_BASE_URL,
    username: process.env.SMOKE_USERNAME,
    password: process.env.SMOKE_PASSWORD,
    adminUsername: process.env.SMOKE_ADMIN_USERNAME,
    adminPassword: process.env.SMOKE_ADMIN_PASSWORD,
    requireAdmin: process.env.SMOKE_REQUIRE_ADMIN === "1",
    requireSessionEpochCompatibility: process.env.SMOKE_REQUIRE_SESSION_EPOCH_COMPAT === "1",
    requireReadiness: process.env.SMOKE_REQUIRE_READINESS === "1",
    expectedWorkerVersion: process.env.SMOKE_EXPECTED_WORKER_VERSION || "",
    verifyPublicSurface: process.env.SMOKE_VERIFY_PUBLIC_SURFACE === "1",
    publicOnly: process.env.SMOKE_PUBLIC_ONLY === "1",
    healthAttempts: process.env.SMOKE_HEALTH_ATTEMPTS || HEALTH_ATTEMPTS,
    healthRetryMs: process.env.SMOKE_HEALTH_RETRY_MS || HEALTH_RETRY_MS,
    assetAttempts: process.env.SMOKE_ASSET_ATTEMPTS || ASSET_ATTEMPTS,
    assetRetryMs: process.env.SMOKE_ASSET_RETRY_MS || ASSET_RETRY_MS
  });
  console.log(`✓ release smoke 통과: ${JSON.stringify(result)}`);
}
