import { bytesToBase64Url } from "../crypto/encoding.js";
import { escapeHtml } from "../../ui/html/escape.js";
import { isDemoReadOnly } from "../../permissions.js";

export function createRenderContext(session = null) {
  const nonce = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(16)));
  const csrfToken = String(session?.csrfToken || "");
  return Object.freeze({
    nonce,
    csrfToken,
    demoReadOnly: isDemoReadOnly(session),
    mustChangePassword: Boolean(session?.mustChangePassword),
    nonceAttribute: `nonce="${escapeHtml(nonce)}"`,
    csrfInput: csrfToken ? `<input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}">` : ""
  });
}

export function safeEmbeddedJson(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
}
