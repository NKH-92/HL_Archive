import { PERMISSIONS } from "../permissions.js";

const ANY = "*";
const route = (id, family, method, path, options = {}) => Object.freeze({
  id, family, method, path,
  auth: options.auth ?? "required",
  permission: options.permission ?? null,
  policy: options.policy ?? null,
  fallback: options.fallback ?? false,
  demoAccess: options.demoAccess ?? (method === "GET" ? "screen" : "blocked"),
  security: Object.freeze({ origin: method === "POST", csrf: method === "POST" && (options.auth ?? "required") === "required", forcedPassword: (options.auth ?? "required") === "required" })
});

export const PUBLIC_ROUTES = Object.freeze([
  route("assets.generated", "assets", ANY, "/assets/:path*", { auth: "public" }),
  route("assets.images", "assets", ANY, "/images/:path*", { auth: "public" }),
  route("assets.favicon", "assets", ANY, "/favicon.ico", { auth: "public" }),
  route("health.read", "health", "GET", "/healthz", { auth: "public" }),
  route("readiness.read", "health", "GET", "/readyz", { auth: "public" }),
  route("session.login.form", "identity", "GET", "/login", { auth: "public" }),
  route("session.login", "identity", "POST", "/login", { auth: "public" }),
  route("session.signup.blocked", "identity", ANY, "/signup", { auth: "public", policy: "always-404" })
]);

export const AUTHENTICATED_ROUTES = Object.freeze([
  route("home.redirect", "search", "GET", "/"),
  route("search.home", "search", "GET", "/app"),
  route("floor-plan.read", "racks", "GET", "/floor-plan"),
  route("qa.read", "identity", "GET", "/qa"),
  route("search.suggestions", "search", "GET", "/api/search-suggestions", { demoAccess: "interactive-read" }),
  route("search.viewer", "search", "GET", "/api/viewer/search", { demoAccess: "interactive-read" }),
  route("search.index", "search", "GET", "/api/search-index", { demoAccess: "blocked" }),
  route("search.click", "search", "POST", "/api/search-click"),
  route("session.password.form", "identity", "GET", "/account/password"),
  route("session.password.change", "identity", "POST", "/account/password", { demoAccess: "forced-password" }),
  route("session.logout", "identity", "POST", "/logout", { demoAccess: "logout" }),
  route("session.logout.fallback", "identity", ANY, "/logout", { fallback: true }),
  route("admin.dashboard", "admin", "GET", "/admin", { policy: "any-management-permission" }),
  route("admin.settings", "identity", "GET", "/admin/settings", { permission: PERMISSIONS.MANAGE_USERS }),
  route("admin.user.create.form", "identity", "GET", "/admin/users/new", {
    permission: PERMISSIONS.MANAGE_USERS,
    policy: "admin-only"
  }),
  route("admin.user.create", "identity", "POST", "/admin/users/new", {
    permission: PERMISSIONS.MANAGE_USERS,
    policy: "admin-only"
  }),
  route("admin.role-templates", "identity", "GET", "/admin/role-templates", {
    permission: PERMISSIONS.MANAGE_USERS,
    policy: "admin-only"
  }),
  route("admin.role-template.edit.form", "identity", "GET", "/admin/role-templates/:key/edit", {
    permission: PERMISSIONS.MANAGE_USERS,
    policy: "admin-only"
  }),
  route("admin.role-template.edit", "identity", "POST", "/admin/role-templates/:key/edit", {
    permission: PERMISSIONS.MANAGE_USERS,
    policy: "admin-only"
  }),
  route("admin.role-template.apply", "identity", "POST", "/admin/role-templates/:key/apply", {
    permission: PERMISSIONS.MANAGE_USERS,
    policy: "admin-only"
  }),
  route("admin.search-report", "audit", "GET", "/admin/search-report", { permission: PERMISSIONS.VIEW_AUDIT }),
  route("admin.audit", "audit", "GET", "/admin/audit", { permission: PERMISSIONS.VIEW_AUDIT }),
  route("admin.movements", "audit", "GET", "/admin/movements", { policy: "move-or-audit" }),
  route("admin.data-quality", "dataQuality", "GET", "/admin/data-quality", { permission: PERMISSIONS.MANAGE_DOCUMENTS }),
  route("admin.user.permissions.form", "identity", "GET", "/admin/users/:id/permissions", { permission: PERMISSIONS.MANAGE_USERS }),
  route("admin.user.permissions", "identity", "POST", "/admin/users/:id/permissions", { permission: PERMISSIONS.MANAGE_USERS }),
  route("admin.user.password-reset.form", "identity", "GET", "/admin/users/:id/reset-password", {
    permission: PERMISSIONS.MANAGE_USERS,
    policy: "admin-only"
  }),
  route("admin.user.password-reset", "identity", "POST", "/admin/users/:id/reset-password", {
    permission: PERMISSIONS.MANAGE_USERS,
    policy: "admin-only"
  }),
  route("admin.user.delete.form", "identity", "GET", "/admin/users/:id/delete", {
    permission: PERMISSIONS.MANAGE_USERS,
    policy: "admin-only"
  }),
  route("admin.user.delete", "identity", "POST", "/admin/users/:id/delete", {
    permission: PERMISSIONS.MANAGE_USERS,
    policy: "admin-only"
  }),
  ...["approve", "reject", "disable", "enable"].map((action) => route(`admin.user.${action}`, "identity", "POST", `/admin/users/:id/${action}`, { permission: PERMISSIONS.MANAGE_USERS })),
  route("documents.duplicate", "documents", "GET", "/api/documents/duplicate", { permission: PERMISSIONS.MANAGE_DOCUMENTS, demoAccess: "blocked" }),
  route("documents.list", "documents", "GET", "/documents"),
  route("documents.create", "documents", "POST", "/documents", { permission: PERMISSIONS.MANAGE_DOCUMENTS }),
  route("documents.disposal", "documents", "GET", "/documents/disposal", { permission: PERMISSIONS.MANAGE_DISPOSALS }),
  route("documents.bulk-dispose", "documents", "POST", "/documents/bulk-dispose", { permission: PERMISSIONS.MANAGE_DISPOSALS }),
  route("documents.disposal.process", "documents", "POST", "/documents/disposal/process", { permission: PERMISSIONS.MANAGE_DISPOSALS }),
  route("documents.dispose-filtered", "documents", "POST", "/documents/dispose-filtered", { permission: PERMISSIONS.MANAGE_DISPOSALS }),
  route("documents.export", "documents", "GET", "/documents/export.csv", { permission: PERMISSIONS.MANAGE_DOCUMENTS, demoAccess: "blocked" }),
  route("documents.snapshot.export", "snapshots", "GET", "/api/document-snapshot/export", { permission: PERMISSIONS.MANAGE_DOCUMENTS, demoAccess: "blocked" }),
  route("documents.snapshot.export.create", "snapshots", "POST", "/document-snapshot-exports", { permission: PERMISSIONS.MANAGE_DOCUMENTS }),
  route("documents.snapshot.export.rows", "snapshots", "GET", "/document-snapshot-exports/:manifestId/rows", { permission: PERMISSIONS.MANAGE_DOCUMENTS, demoAccess: "blocked" }),
  route("documents.snapshot.export.finalize", "snapshots", "POST", "/document-snapshot-exports/:manifestId/finalize", { permission: PERMISSIONS.MANAGE_DOCUMENTS }),
  route("documents.import.form", "imports", "GET", "/documents/import", { permission: PERMISSIONS.MANAGE_DOCUMENTS }),
  route("documents.new", "documents", "GET", "/documents/new", { permission: PERMISSIONS.MANAGE_DOCUMENTS }),
  route("documents.details", "documents", "GET", "/documents/:id"),
  route("documents.edit.form", "documents", "GET", "/documents/:id/edit", { permission: PERMISSIONS.MANAGE_DOCUMENTS }),
  route("documents.edit", "documents", "POST", "/documents/:id/edit", { permission: PERMISSIONS.MANAGE_DOCUMENTS }),
  route("documents.revise.form", "documents", "GET", "/documents/:id/revise", { permission: PERMISSIONS.MANAGE_DOCUMENTS }),
  route("documents.revise", "documents", "POST", "/documents/:id/revise", { permission: PERMISSIONS.MANAGE_DOCUMENTS }),
  route("documents.move.form", "documents", "GET", "/documents/:id/move", { permission: PERMISSIONS.MOVE_DOCUMENTS }),
  route("documents.move", "documents", "POST", "/documents/:id/move", { permission: PERMISSIONS.MOVE_DOCUMENTS }),
  route("documents.dispose", "documents", "POST", "/documents/:id/dispose", { permission: PERMISSIONS.MANAGE_DISPOSALS }),
  route("documents.restore", "documents", "POST", "/documents/:id/restore", { policy: "admin-only" }),
  route("sets.list", "sets", "GET", "/sets"),
  route("sets.create.form", "sets", "GET", "/sets/new", { permission: PERMISSIONS.MANAGE_SETS }),
  route("sets.create", "sets", "POST", "/sets", { permission: PERMISSIONS.MANAGE_SETS }),
  route("sets.details", "sets", "GET", "/sets/:id"),
  route("sets.export", "sets", "GET", "/sets/:id/export", { demoAccess: "blocked" }),
  route("sets.export.csv", "sets", "GET", "/sets/:id/export.csv", { demoAccess: "blocked" }),
  route("sets.edit.form", "sets", "GET", "/sets/:id/edit", { permission: PERMISSIONS.MANAGE_SETS }),
  route("sets.clone.form", "sets", "GET", "/sets/:id/clone", { permission: PERMISSIONS.MANAGE_SETS }),
  route("sets.clone", "sets", "POST", "/sets/:id/clone", { permission: PERMISSIONS.MANAGE_SETS }),
  ...["edit", "delete", "add", "remove", "lock", "unlock"].map((action) => route(`sets.${action}`, "sets", "POST", `/sets/:id/${action}`, { permission: PERMISSIONS.MANAGE_SETS })),
  route("racks.list", "racks", "GET", "/racks", { permission: PERMISSIONS.MANAGE_MASTERS }),
  route("racks.create", "racks", "POST", "/racks", { permission: PERMISSIONS.MANAGE_MASTERS }),
  route("racks.new", "racks", "GET", "/racks/new", { permission: PERMISSIONS.MANAGE_MASTERS }),
  route("racks.configure.form", "racks", "GET", "/racks/configure", { permission: PERMISSIONS.MANAGE_MASTERS }),
  route("racks.configure", "racks", "POST", "/racks/configure", { permission: PERMISSIONS.MANAGE_MASTERS }),
  route("racks.details", "racks", "GET", "/racks/:id", { permission: PERMISSIONS.MANAGE_MASTERS }),
  route("racks.edit.form", "racks", "GET", "/racks/:id/edit", { permission: PERMISSIONS.MANAGE_MASTERS }),
  route("racks.edit", "racks", "POST", "/racks/:id/edit", { permission: PERMISSIONS.MANAGE_MASTERS }),
  ...masterRoutes("categories"),
  ...masterRoutes("tags"),
  ...workflowRoutes("disposal-batches", "disposal", PERMISSIONS.MANAGE_DISPOSALS, ["edit", "freeze", "start", "process", "cancel"]),
  route("disposal.export", "disposal", "GET", "/disposal-batches/:id/export.csv", { permission: PERMISSIONS.MANAGE_DISPOSALS, demoAccess: "blocked" }),
  route("disposal.item.exclude", "disposal", "POST", "/disposal-batches/:id/items/:itemId/exclude", { permission: PERMISSIONS.MANAGE_DISPOSALS }),
  route("disposal.item.include", "disposal", "POST", "/disposal-batches/:id/items/:itemId/include", { permission: PERMISSIONS.MANAGE_DISPOSALS }),
  route("imports.list", "imports", "GET", "/document-import-jobs", { permission: PERMISSIONS.MANAGE_DOCUMENTS }),
  route("imports.create", "imports", "POST", "/document-import-jobs", { permission: PERMISSIONS.MANAGE_DOCUMENTS }),
  route("imports.details", "imports", "GET", "/document-import-jobs/:id", { permission: PERMISSIONS.MANAGE_DOCUMENTS }),
  route("imports.failures", "imports", "GET", "/document-import-jobs/:id/failures.csv", { permission: PERMISSIONS.MANAGE_DOCUMENTS, demoAccess: "blocked" }),
  route("imports.process", "imports", "POST", "/document-import-jobs/:id/process", { permission: PERMISSIONS.MANAGE_DOCUMENTS }),
  route("imports.cancel", "imports", "POST", "/document-import-jobs/:id/cancel", { permission: PERMISSIONS.MANAGE_DOCUMENTS }),
  route("snapshots.list", "snapshots", "GET", "/document-snapshots", { permission: PERMISSIONS.MANAGE_DOCUMENTS }),
  route("snapshots.create", "snapshots", "POST", "/document-snapshots", { permission: PERMISSIONS.MANAGE_DOCUMENTS }),
  route("snapshots.details", "snapshots", "GET", "/document-snapshots/:id", { permission: PERMISSIONS.MANAGE_DOCUMENTS }),
  route("snapshots.rows", "snapshots", "POST", "/document-snapshots/:id/rows", { permission: PERMISSIONS.MANAGE_DOCUMENTS }),
  route("snapshots.membership", "snapshots", "POST", "/document-snapshots/:id/membership", { permission: PERMISSIONS.MANAGE_DOCUMENTS }),
  route("snapshots.prepare", "snapshots", "POST", "/document-snapshots/:id/prepare", { permission: PERMISSIONS.MANAGE_DOCUMENTS }),
  route("snapshots.apply", "snapshots", "POST", "/document-snapshots/:id/apply", {
    // 실행 계약: 문서 관리 + 스냅샷 반영 권한을 모두 요구한다(카탈로그·핸들러·서비스 동일).
    permission: `${PERMISSIONS.MANAGE_DOCUMENTS}+${PERMISSIONS.APPLY_DOCUMENT_SNAPSHOTS}`,
    policy: "allOf:can_manage_documents+can_apply_document_snapshots"
  }),
  route("snapshots.cancel", "snapshots", "POST", "/document-snapshots/:id/cancel", { permission: PERMISSIONS.MANAGE_DOCUMENTS })
]);

export const ROUTES = Object.freeze([...PUBLIC_ROUTES, ...AUTHENTICATED_ROUTES]);

export function resolvePublicRoute(path, method) { return resolve(PUBLIC_ROUTES, path, method); }
export function resolveAuthenticatedRoute(path, method) { return resolve(AUTHENTICATED_ROUTES, path, method); }

export function allowedMethodsForPath(path) {
  const matches = ROUTES.filter((item) => matchPath(item.path, path));
  if (!matches.length) return Object.freeze([]);
  const methods = new Set();
  for (const item of matches) {
    if (item.method === ANY) {
      methods.add("GET");
      methods.add("HEAD");
      if (item.family !== "assets") methods.add("POST");
    } else {
      methods.add(item.method);
      if (item.method === "GET") methods.add("HEAD");
    }
  }
  methods.add("OPTIONS");
  const order = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
  return Object.freeze([...methods].sort((left, right) => order.indexOf(left) - order.indexOf(right)));
}

export function routeStatus(path, method, authenticated = true) {
  const routes = authenticated ? AUTHENTICATED_ROUTES : PUBLIC_ROUTES;
  if (resolve(routes, path, method)) return 200;
  return routes.some((item) => matchPath(item.path, path)) ? 405 : 404;
}

export function urlFor(id, params = {}, query = {}) {
  const descriptor = ROUTES.find((item) => item.id === id);
  if (!descriptor) throw new TypeError(`알 수 없는 route id: ${id}`);
  let path = descriptor.path.replace(/:([A-Za-z][A-Za-z0-9]*)(\*)?/g, (_, name, wildcard) => {
    if (!(name in params)) throw new TypeError(`${id}: ${name} parameter가 필요합니다.`);
    return wildcard ? String(params[name]).split("/").map(encodeURIComponent).join("/") : encodeURIComponent(String(params[name]));
  });
  const search = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== "" && value !== null && value !== undefined));
  if (search.size) path += `?${search}`;
  return path;
}

export function routeCollisions(routes = ROUTES) {
  const collisions = [];
  for (let left = 0; left < routes.length; left += 1) for (let right = left + 1; right < routes.length; right += 1) {
    const a = routes[left]; const b = routes[right];
    if (a.path === b.path && methodsOverlap(a, b) && !(a.fallback || b.fallback)) collisions.push([a.id, b.id]);
  }
  return collisions;
}

function resolve(routes, path, method) {
  const matches = routes.filter((item) => matchPath(item.path, path));
  const descriptor = matches.find((item) => item.method === method) || matches.find((item) => item.method === ANY);
  if (!descriptor) return null;
  return Object.freeze({ descriptor, params: Object.freeze(pathParams(descriptor.path, path)) });
}

function matchPath(template, path) { return compile(template).test(path); }
function pathParams(template, path) {
  const names = [...template.matchAll(/:([A-Za-z][A-Za-z0-9]*)(\*)?/g)].map((match) => match[1]);
  const match = path.match(compile(template));
  return Object.fromEntries(names.map((name, index) => [name, /^\d+$/.test(match[index + 1]) ? Number(match[index + 1]) : decodeURIComponent(match[index + 1])]));
}
function compile(template) {
  const source = template.split("/").map((part) => {
    if (/^:[A-Za-z][A-Za-z0-9]*\*$/.test(part)) return "(.*)";
    if (/^:(id|itemId)$/.test(part)) return "(\\d+)";
    if (/^:/.test(part)) return "([^/]+)";
    return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }).join("/");
  return new RegExp(`^${source}$`);
}
function methodsOverlap(a, b) { return a.method === b.method || a.method === ANY || b.method === ANY; }
function masterRoutes(name) {
  const permission = PERMISSIONS.MANAGE_MASTERS;
  return [
    route(`${name}.list`, "masters", "GET", `/${name}`, { permission }),
    route(`${name}.save`, "masters", "POST", `/${name}`, { permission }),
    route(`${name}.edit`, "masters", "POST", `/${name}/:id/edit`, { permission }),
    route(`${name}.delete`, "masters", "POST", `/${name}/:id/delete`, { permission })
  ];
}
function workflowRoutes(base, prefix, permission, actions) {
  return [
    route(`${prefix}.list`, prefix, "GET", `/${base}`, { permission }),
    route(`${prefix}.new`, prefix, "GET", `/${base}/new`, { permission }),
    route(`${prefix}.create`, prefix, "POST", `/${base}`, { permission }),
    route(`${prefix}.details`, prefix, "GET", `/${base}/:id`, { permission }),
    route(`${prefix}.edit.form`, prefix, "GET", `/${base}/:id/edit`, { permission }),
    ...actions.map((action) => route(`${prefix}.${action}`, prefix, "POST", `/${base}/:id/${action}`, { permission }))
  ];
}
