/**
 * Permission-based page gating and redirect logic.
 *
 * After artifact consolidation (migration 30), VIEW artifacts are folded
 * into 3 parents with compound operations:
 *   attempt ← home_, practice_, chat_, dashboard_, leaderboard_, reports_, record_
 *   test    ← invocation_, benchmark_
 *   system  ← activity_, session_, pricing_, group_, health_
 *
 * role_permissions is a list of [artifact, operation] tuples.
 * Compound operations like "home_get" tell us the user can access /home.
 * CRUD artifacts (agent, profile, etc.) just need any operation on that artifact.
 */

import { redirect } from "next/navigation";

// ---------------------------------------------------------------------------
// Page → permission rule mapping
// ---------------------------------------------------------------------------

interface PermissionRule {
  /** Parent artifact that owns this page */
  artifact: string;
  /** Operation prefix for compound VIEW pages (e.g. "home_") */
  prefix?: string;
}

/**
 * Maps each client route to the permission check needed.
 * VIEW pages check for compound operation prefix under parent.
 * CRUD pages just check for any operation on that artifact.
 */
const PAGE_RULES: Record<string, PermissionRule> = {
  // attempt children
  "/home": { artifact: "attempt", prefix: "home_" },
  "/practice": { artifact: "attempt", prefix: "practice_" },
  "/chat": { artifact: "attempt", prefix: "chat_" },
  "/analytics/dashboard": { artifact: "attempt", prefix: "dashboard_" },
  "/leaderboard": { artifact: "attempt", prefix: "leaderboard_" },
  "/analytics/reports": { artifact: "attempt", prefix: "reports_" },
  "/record": { artifact: "attempt", prefix: "record_" },
  // test children
  "/benchmark": { artifact: "test", prefix: "benchmark_" },
  "/invocation": { artifact: "test", prefix: "invocation_" },
  // system children
  "/analytics/activity": { artifact: "system", prefix: "activity_" },
  "/session": { artifact: "system", prefix: "session_" },
  "/analytics/pricing": { artifact: "system", prefix: "pricing_" },
  "/group": { artifact: "system", prefix: "group_" },
  "/health": { artifact: "system", prefix: "health_" },
  // CRUD artifacts (no prefix — any operation means access)
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
 * Ordered landing pages — first match is where we redirect.
 * Attempt views first (most users land here), then test, system, then CRUD.
 */
const LANDING_PAGES: { rule: PermissionRule; path: string }[] = [
  { rule: { artifact: "attempt", prefix: "home_" }, path: "/home" },
  { rule: { artifact: "attempt", prefix: "practice_" }, path: "/practice" },
  { rule: { artifact: "attempt", prefix: "chat_" }, path: "/chat" },
  { rule: { artifact: "attempt", prefix: "dashboard_" }, path: "/analytics/dashboard" },
  { rule: { artifact: "attempt", prefix: "leaderboard_" }, path: "/leaderboard" },
  { rule: { artifact: "attempt", prefix: "reports_" }, path: "/analytics/reports" },
  { rule: { artifact: "attempt", prefix: "record_" }, path: "/record" },
  { rule: { artifact: "test", prefix: "benchmark_" }, path: "/benchmark" },
  { rule: { artifact: "test", prefix: "invocation_" }, path: "/invocation" },
  { rule: { artifact: "system", prefix: "health_" }, path: "/health" },
  { rule: { artifact: "system", prefix: "activity_" }, path: "/analytics/activity" },
  { rule: { artifact: "system", prefix: "pricing_" }, path: "/analytics/pricing" },
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
  if (rule.prefix) {
    // VIEW page: need at least one compound operation with this prefix
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
 * For VIEW items (with a prefix), checks compound operations.
 * For CRUD items, checks any operation on that artifact.
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
 * VIEW artifacts (home, practice, etc.) → compound prefix under parent.
 * CRUD artifacts → direct artifact check.
 */
function findRuleForArtifact(artifact: string): PermissionRule {
  // VIEW children → compound operations under parent
  const VIEW_PARENTS: Record<string, string> = {
    home: "attempt",
    practice: "attempt",
    chat: "attempt",
    dashboard: "attempt",
    leaderboard: "attempt",
    reports: "attempt",
    record: "attempt",
    invocation: "test",
    benchmark: "test",
    activity: "system",
    session: "system",
    pricing: "system",
    group: "system",
    health: "system",
  };

  const parent = VIEW_PARENTS[artifact];
  if (parent) {
    return { artifact: parent, prefix: `${artifact}_` };
  }
  // CRUD artifact — direct check
  return { artifact };
}
