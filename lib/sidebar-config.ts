/**
 * Client-side sidebar configuration.
 * Defines the navigation menu structure — filtered at runtime
 * by `role_artifacts` from the profile context.
 *
 * Each section maps to one or more artifacts. A section is visible
 * if the user's role has ANY of the section's artifacts.
 */

export interface SidebarChildItem {
  title: string;
  artifact: string;
  url: string;
}

export interface SidebarSectionConfig {
  title: string;
  icon: string;
  url: string;
  order: number;
  /** For leaf sections (no children), the artifact that gates visibility. */
  artifact?: string;
  /** For parent sections, children with their own artifacts. */
  items?: SidebarChildItem[];
}

/**
 * All possible sidebar sections, ordered by display priority.
 * Sections are filtered by role_artifacts from the profile API.
 */
export const SIDEBAR_SECTIONS: SidebarSectionConfig[] = [
  {
    title: "Home",
    artifact: "home",
    icon: "Home",
    url: "/home",
    order: 0,
  },
  {
    title: "Practice",
    artifact: "practice",
    icon: "Target",
    url: "/practice",
    order: 1,
  },
  {
    title: "Leaderboard",
    artifact: "leaderboard",
    icon: "Trophy",
    url: "/leaderboard",
    order: 2,
  },
  {
    title: "Analytics",
    icon: "PieChart",
    url: "/analytics/dashboard",
    order: 3,
    items: [
      { title: "Dashboard", artifact: "dashboard", url: "/analytics/dashboard" },
      { title: "Reports", artifact: "reports", url: "/analytics/reports" },
      { title: "Activity", artifact: "activity", url: "/analytics/activity" },
      { title: "Pricing", artifact: "pricing", url: "/analytics/pricing" },
    ],
  },
  {
    title: "Training",
    icon: "GraduationCap",
    url: "/training/cohorts",
    order: 4,
    items: [
      { title: "Cohorts", artifact: "cohort", url: "/training/cohorts" },
      { title: "Simulations", artifact: "simulation", url: "/training/simulations" },
      { title: "Scenarios", artifact: "scenario", url: "/training/scenarios" },
      { title: "Personas", artifact: "persona", url: "/training/personas" },
    ],
  },
  {
    title: "Management",
    icon: "ClipboardList",
    url: "/management/profiles",
    order: 5,
    items: [
      { title: "Profiles", artifact: "profile", url: "/management/profiles" },
      { title: "Documents", artifact: "document", url: "/management/documents" },
      { title: "Parameters", artifact: "parameter", url: "/management/parameters" },
      { title: "Fields", artifact: "field", url: "/management/fields" },
    ],
  },
  {
    title: "Intelligence",
    icon: "Sparkles",
    url: "/intelligence/agents",
    order: 6,
    items: [
      { title: "Agents", artifact: "agent", url: "/intelligence/agents" },
      { title: "Models", artifact: "model", url: "/intelligence/models" },
      { title: "Providers", artifact: "provider", url: "/intelligence/providers" },
      { title: "Tools", artifact: "tool", url: "/intelligence/tools" },
    ],
  },
  {
    title: "System",
    icon: "Server",
    url: "/system/departments",
    order: 7,
    items: [
      { title: "Departments", artifact: "department", url: "/system/departments" },
      { title: "Rubrics", artifact: "rubric", url: "/system/rubrics" },
      { title: "Auth", artifact: "auth", url: "/system/auth" },
      { title: "Evals", artifact: "eval", url: "/system/evals" },
    ],
  },
  {
    title: "Health",
    artifact: "health",
    icon: "Activity",
    url: "/health",
    order: 8,
  },
  {
    title: "Benchmark",
    artifact: "benchmark",
    icon: "Gauge",
    url: "/benchmark",
    order: 9,
  },
  {
    title: "Settings",
    artifact: "setting",
    icon: "Settings",
    url: "/settings",
    order: 10,
  },
];

/**
 * Filter sidebar sections by role artifacts.
 * A section is visible if the user has ANY of its artifacts.
 * For parent sections with children, uses child artifacts.
 * For leaf sections, uses the section's own artifact.
 */
export function getSidebarSections(roleArtifacts: string[]): SidebarSectionConfig[] {
  const artifactSet = new Set(roleArtifacts);
  return SIDEBAR_SECTIONS.filter((s) => {
    if (s.items) {
      return s.items.some((item) => artifactSet.has(item.artifact));
    }
    return s.artifact ? artifactSet.has(s.artifact) : false;
  });
}
