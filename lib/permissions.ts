/**
 * Permission-based page gating and redirect logic.
 *
 * Post-flatten reality: VIEW artifacts collapsed into a single op under
 * the parent. So /home maps to (attempt, "home"), /analytics/dashboard
 * to (attempt, "dashboard"), /system/activity → (system, "activity"),
 * etc. Chat and invocation are exceptions — they retain compound real
 * ops like (attempt, "chat_message") and (test, "invocation_run"), so
 * those still match via a prefix.
 *
 * role_permissions is a list of [artifact, operation] tuples returned
 * by the API. Each rule below either compares the operation exactly
 * (single-op pages) or by prefix (chat/invocation sub-domains).
 */

import { redirect } from "next/navigation";

// ---------------------------------------------------------------------------
// Page → permission rule mapping
// ---------------------------------------------------------------------------

interface PermissionRule {
  /** Parent artifact that owns this page (e.g. "attempt", "system"). */
  artifact: string;
  /**
   * Exact operation name to match. Use for single-op collapsed views
   * (home, practice, dashboard, leaderboard, report, activity, …).
   */
  op?: string;
  /**
   * Operation prefix to match. Use only for sub-domains that retain
   * compound ops post-flatten (e.g. "chat_" for chat_message/audio/...
   * or "invocation_" for invocation_get/create/run/...).
   */
  prefix?: string;
}

/**
 * Maps each client route to the permission check needed.
 * Single-op pages use ``op``; compound sub-domains use ``prefix``.
 * CRUD pages omit both — any operation on the artifact grants access.
 */
const PAGE_RULES: Record<string, PermissionRule> = {
  // attempt children (collapsed views → exact op match)
  "/home": { artifact: "attempt", op: "home" },
  "/practice": { artifact: "attempt", op: "practice" },
  "/analytics/dashboard": { artifact: "attempt", op: "dashboard" },
  "/leaderboard": { artifact: "attempt", op: "leaderboard" },
  "/analytics/reports": { artifact: "attempt", op: "report" },
  // chat retains compound ops (chat_message, chat_audio, …)
  // No top-level /chat page exists — chat is opened via /attempt/[id]/[chatId].
  // test children
  "/benchmark": { artifact: "test", op: "benchmark" },
  // invocation retains compound ops (invocation_get, invocation_run, …)
  "/invocation": { artifact: "test", prefix: "invocation_" },
  // system children (collapsed views → exact op match)
  "/analytics/activity": { artifact: "system", op: "activity" },
  "/session": { artifact: "system", op: "session" },
  "/analytics/pricing": { artifact: "system", op: "pricing" },
  "/group": { artifact: "system", op: "group" },
  "/health": { artifact: "system", op: "health" },
  // CRUD artifacts (no op/prefix — any operation means access)
  "/training/cohorts": { artifact: "cohort" },
  "/training/simulations": { artifact: "simulation" },
  "/training/scenarios": { artifact: "scenario" },
  "/training/personas": { artifact: "persona" },
  "/management/profiles": { artifact: "profile" },
  "/management/documents": { artifact: "document" },
  "/management/parameters": { artifact: "parameter" },
  "/management/fields": { artifact: "field" },
  "/intelligence/agents": { artifact: "agent" },
  "/intelligence/models": { artifact: "model" },
  "/intelligence/providers": { artifact: "provider" },
  "/intelligence/tools": { artifact: "tool" },
  "/system/departments": { artifact: "department" },
  "/system/rubrics": { artifact: "rubric" },
  "/system/auth": { artifact: "auth" },
  "/system/evals": { artifact: "eval" },
  "/settings": { artifact: "setting" },
};

/**
 * Ordered landing pages — first match is where we redirect after login.
 * Attempt views first (most users land here), then test, system, then CRUD.
 */
const LANDING_PAGES: { rule: PermissionRule; path: string }[] = [
  { rule: { artifact: "attempt", op: "home" }, path: "/home" },
  { rule: { artifact: "attempt", op: "practice" }, path: "/practice" },
  { rule: { artifact: "attempt", op: "dashboard" }, path: "/analytics/dashboard" },
  { rule: { artifact: "attempt", op: "leaderboard" }, path: "/leaderboard" },
  { rule: { artifact: "attempt", op: "report" }, path: "/analytics/reports" },
  { rule: { artifact: "test", op: "benchmark" }, path: "/benchmark" },
  { rule: { artifact: "test", prefix: "invocation_" }, path: "/invocation" },
  { rule: { artifact: "system", op: "health" }, path: "/health" },
  { rule: { artifact: "system", op: "activity" }, path: "/analytics/activity" },
  { rule: { artifact: "system", op: "pricing" }, path: "/analytics/pricing" },
  { rule: { artifact: "cohort" }, path: "/training/cohorts" },
  { rule: { artifact: "simulation" }, path: "/training/simulations" },
  { rule: { artifact: "scenario" }, path: "/training/scenarios" },
  { rule: { artifact: "persona" }, path: "/training/personas" },
  { rule: { artifact: "profile" }, path: "/management/profiles" },
  { rule: { artifact: "agent" }, path: "/intelligence/agents" },
  { rule: { artifact: "setting" }, path: "/settings" },
];

// ---------------------------------------------------------------------------
// Core permission check
// ---------------------------------------------------------------------------

/**
 * Check if the user has access to a specific page based on role_permissions.
 */
export function canAccess(
  rule: PermissionRule,
  rolePermissions: [string, string][],
): boolean {
  if (rule.op) {
    // Single-op page: exact match
    return rolePermissions.some(
      ([art, op]) => art === rule.artifact && op === rule.op,
    );
  }
  if (rule.prefix) {
    // Sub-domain with compound ops: prefix match
    return rolePermissions.some(
      ([art, op]) => art === rule.artifact && op.startsWith(rule.prefix!),
    );
  }
  // CRUD page: any operation on this artifact
  return rolePermissions.some(([art]) => art === rule.artifact);
}

/**
 * Check if a user can access a page by pathname.
 */
export function canAccessPage(
  pathname: string,
  rolePermissions: [string, string][],
): boolean {
  const rule = PAGE_RULES[pathname];
  if (!rule) return true; // unknown route, allow
  return canAccess(rule, rolePermissions);
}

// ---------------------------------------------------------------------------
// Server-side guard (call from page.tsx after context fetch)
// ---------------------------------------------------------------------------

/**
 * Guard a page — if the user can't access it, redirect to the first
 * page they CAN access. Call this in server components after context fetch.
 *
 * @example
 * ```ts
 * const context = await api.post("/attempt/context", { body: {} });
 * guardPage("/home", context.profile.role_permissions);
 * ```
 */
export function guardPage(
  pathname: string,
  rolePermissions: [string, string][],
): void {
  if (canAccessPage(pathname, rolePermissions)) return;

  // Find first accessible landing page
  const landing = LANDING_PAGES.find((lp) =>
    canAccess(lp.rule, rolePermissions),
  );
  redirect(landing?.path ?? "/");
}

// ---------------------------------------------------------------------------
// Sidebar filtering (replaces artifact-only getSidebarSections)
// ---------------------------------------------------------------------------

/**
 * Check if a sidebar item is visible based on role_permissions.
 * VIEW items use exact op (or prefix for chat/invocation); CRUD items
 * match on any operation on the artifact.
 */
export function canAccessSidebarItem(
  artifact: string,
  rolePermissions: [string, string][],
): boolean {
  const rule = findRuleForArtifact(artifact);
  return canAccess(rule, rolePermissions);
}

/**
 * Given a sidebar artifact name, find its permission rule.
 * Collapsed VIEW children → exact op on parent. Compound sub-domains
 * (chat, invocation) → prefix match. CRUD artifacts → direct check.
 */
function findRuleForArtifact(artifact: string): PermissionRule {
  // Collapsed VIEW children → single op on parent
  const VIEW_PARENTS: Record<string, { parent: string; op: string }> = {
    home: { parent: "attempt", op: "home" },
    practice: { parent: "attempt", op: "practice" },
    dashboard: { parent: "attempt", op: "dashboard" },
    leaderboard: { parent: "attempt", op: "leaderboard" },
    reports: { parent: "attempt", op: "report" },
    benchmark: { parent: "test", op: "benchmark" },
    activity: { parent: "system", op: "activity" },
    session: { parent: "system", op: "session" },
    pricing: { parent: "system", op: "pricing" },
    group: { parent: "system", op: "group" },
    health: { parent: "system", op: "health" },
  };
  const mapped = VIEW_PARENTS[artifact];
  if (mapped) {
    return { artifact: mapped.parent, op: mapped.op };
  }

  // Sub-domains with compound ops
  const COMPOUND: Record<string, { parent: string; prefix: string }> = {
    chat: { parent: "attempt", prefix: "chat_" },
    invocation: { parent: "test", prefix: "invocation_" },
  };
  const comp = COMPOUND[artifact];
  if (comp) {
    return { artifact: comp.parent, prefix: comp.prefix };
  }

  // CRUD artifact — direct check
  return { artifact };
}
