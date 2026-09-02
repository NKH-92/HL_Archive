import { accessDeniedPage } from "../views/authViews.js";

export function requireAdmin(session) {
  return session.role === "Admin" || session?.demoReadAuthorized ? null : accessDeniedPage(session);
}
