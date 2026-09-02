import {
  base64UrlToBytes,
  bytesToBase64Url,
  constantTimeEqual
} from "../platform/crypto/encoding.js";
import { parseCookies } from "../platform/http/cookies.js";
import { ACCESS_MODES, permissionFlags, PERMISSION_KEYS } from "../permissions.js";
import { normalizeRole } from "./shared.js";

export const SESSION_COOKIE = "hanlim_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const CSRF_TOKEN_BYTES = 32;

export function getMissingSetup(env) {
  const required = ["SESSION_SECRET"];
  const missing = required.filter((key) => !env[key]);

  if (missing.length) {
    return `Cloudflare secret/variable 설정이 필요합니다: ${missing.join(", ")}`;
  }

  if (env.SESSION_SECRET.length < 32) {
    return "SESSION_SECRET는 최소 32자 이상의 랜덤 문자열이어야 합니다.";
  }

  return "";
}

export async function createSessionCookie(user, env, secure = true) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const sessionEpoch = readSessionEpoch(user.sessionEpoch ?? user.session_epoch);
  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    mustChangePassword: Boolean(user.mustChangePassword),
    sessionEpoch,
    csrfToken: createCsrfToken(),
    exp
  })));
  const signature = await sign(payload, env);

  const secureAttribute = secure ? "; Secure" : "";
  return `${SESSION_COOKIE}=${payload}.${signature}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly${secureAttribute}; SameSite=Lax`;
}

export async function readSession(request, env) {
  const cookies = parseCookies(request.headers.get("Cookie") || "");
  const value = cookies[SESSION_COOKIE];

  if (!value || !value.includes(".")) {
    return null;
  }

  const [payload, signature] = value.split(".", 2);
  const expected = await sign(payload, env);

  if (!constantTimeEqual(expected, signature)) {
    return null;
  }

  try {
    const json = new TextDecoder().decode(base64UrlToBytes(payload));
    const session = JSON.parse(json);

    if (!session.exp || session.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    if (!["Admin", "User"].includes(session.role)) {
      return null;
    }

    if (typeof session.csrfToken !== "string" || session.csrfToken.length < 32) {
      return null;
    }

    const user = await loadSessionUser(env, session.username);

    // 보안 검토 대상 계정과 credential/session epoch가 바뀐 기존 cookie는 즉시 무효화한다.
    // pre-0034 스키마에는 security_review_required가 없을 수 있다.
    if (
      !user
      || user.status !== "approved"
      || Number(user.security_review_required || 0) === 1
      || Number(user.account_expired || 0) === 1
    ) {
      return null;
    }
    const currentSessionEpoch = readSessionEpoch(user.session_epoch);
    // compatibility Worker 이전에 발급된 cookie는 epoch 0으로 취급한다. DB epoch가
    // 한 번이라도 회전한 계정에서는 그대로 불일치해 재사용되지 않는다.
    if (readSessionEpoch(session.sessionEpoch) !== currentSessionEpoch) {
      return null;
    }

    return {
      ...session,
      userId: Number(user.id) || null,
      username: user.username,
      displayName: user.display_name,
      role: normalizeRole(user.role),
      mustChangePassword: Number(user.must_change_password) === 1,
      sessionEpoch: currentSessionEpoch,
      roleTemplateKey: user.role_template_key || null,
      roleTemplateLabel: user.role_template_label || null,
      accessMode: user.access_mode === ACCESS_MODES.DEMO_READONLY
        ? ACCESS_MODES.DEMO_READONLY
        : ACCESS_MODES.STANDARD,
      ...permissionFlags(user)
    };
  } catch {
    return null;
  }
}

export function expiredSessionCookie(secure = true) {
  const secureAttribute = secure ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly${secureAttribute}; SameSite=Lax`;
}

export async function revokeUserSessions(env, username, expectedEpoch) {
  const epoch = readSessionEpoch(expectedEpoch);
  const result = await env.DB.prepare(`
    UPDATE app_users
    SET session_epoch = session_epoch + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE username = ? AND session_epoch = ?
  `).bind(String(username || ""), epoch).run();
  return Number(result?.meta?.changes || 0) === 1;
}

async function loadSessionUser(env, username) {
  try {
    return await env.DB.prepare(`
      SELECT u.*,
        t.label AS role_template_label,
        CASE
          WHEN u.expires_at IS NOT NULL AND u.expires_at <= CURRENT_TIMESTAMP THEN 1
          ELSE 0
        END AS account_expired
      FROM app_users u
      LEFT JOIN user_role_templates t
        ON t.key = u.role_template_key
        AND ${PERMISSION_KEYS.map((permission) => `t.${permission} = u.${permission}`).join("\n        AND ")}
      WHERE u.username = ?
      LIMIT 1
    `).bind(username).first();
  } catch (error) {
    if (!/no such (column|table):/i.test(String(error?.message || error))) {
      throw error;
    }
  }
  const legacy = await env.DB.prepare(`
    SELECT *
    FROM app_users
    WHERE username = ?
    LIMIT 1
  `).bind(username).first();
  return legacy ? { ...legacy, account_expired: 0 } : null;
}

function createCsrfToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(CSRF_TOKEN_BYTES));
  return bytesToBase64Url(bytes);
}

function readSessionEpoch(value) {
  const epoch = Number(value ?? 0);
  return Number.isSafeInteger(epoch) && epoch >= 0 ? epoch : 0;
}

async function sign(payload, env) {
  const secret = getSessionSecret(env);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));

  return bytesToBase64Url(new Uint8Array(signature));
}

function getSessionSecret(env) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET must be set to a random value of at least 32 characters.");
  }

  return env.SESSION_SECRET;
}
