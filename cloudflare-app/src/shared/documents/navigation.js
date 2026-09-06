import { sanitizeReturnUrl } from "../../platform/security/returnUrl.js";

// 외부 주소와 다른 업무 경로를 복귀 대상으로 받지 않는다.
export function documentReturnTo(value) {
  const path = sanitizeReturnUrl(value);
  const url = new URL(path, "https://archive.local");
  if (url.origin !== "https://archive.local" || !["/app", "/documents"].includes(url.pathname)) return "";
  const params = new URLSearchParams();
  for (const key of ["q", "category", "tag", "zone", "rack", "face", "column", "shelf", "sort"]) {
    if (url.searchParams.has(key)) params.set(key, url.searchParams.get(key));
  }
  return `/app${params.size ? `?${params}` : ""}`;
}

export function documentLink(id, action = "", returnTo = "", toast = "") {
  const params = new URLSearchParams();
  const safe = documentReturnTo(returnTo);
  if (safe) params.set("returnTo", safe);
  if (toast) params.set("toast", toast);
  return `/documents/${Number(id)}${action ? `/${action}` : ""}${params.size ? `?${params}` : ""}`;
}
