/**
 * Client-side sidebar configuration.
 * Defines the navigation menu structure — filtered at runtime
 * by `availableSections` from the profile context.
 */

export interface SidebarChildItem {
  title: string;
  section: string;
  url: string;
}

export interface SidebarSectionConfig {
  title: string;
  section: string;
  icon: string;
  url: string;
  order: number;
  items?: SidebarChildItem[];
}

/**
 * All possible sidebar sections, ordered by display priority.
 * Sections are filtered by `availableSections` from the profile API.
 */
export const SIDEBAR_SECTIONS: SidebarSectionConfig[] = [
  {
    title: "Home",
    section: "home",
    icon: "Home",
    url: "/home",
    order: 0,
  },
  {
    title: "Practice",
    section: "practice",
    icon: "Target",
    url: "/practice",
    order: 1,
  },
  {
    title: "Leaderboard",
    section: "leaderboard",
    icon: "Trophy",
    url: "/leaderboard",
    order: 2,
  },
  {
    title: "Analytics",
    section: "analytics",
    icon: "PieChart",
    url: "/analytics/dashboard",
    order: 3,
    items: [
      { title: "Dashboard", section: "dashboard", url: "/analytics/dashboard" },
      { title: "Reports", section: "reports", url: "/analytics/reports" },
      { title: "Activity", section: "activity", url: "/analytics/activity" },
      { title: "Pricing", section: "pricing", url: "/analytics/pricing" },
    ],
  },
  {
    title: "Training",
    section: "training",
    icon: "GraduationCap",
    url: "/training/cohorts",
    order: 4,
    items: [
      { title: "Cohorts", section: "cohorts", url: "/training/cohorts" },
      { title: "Simulations", section: "simulations", url: "/training/simulations" },
      { title: "Scenarios", section: "scenarios", url: "/training/scenarios" },
      { title: "Personas", section: "personas", url: "/training/personas" },
    ],
  },
  {
    title: "Management",
    section: "management",
    icon: "ClipboardList",
    url: "/management/profiles",
    order: 5,
    items: [
      { title: "Profiles", section: "profiles", url: "/management/profiles" },
      { title: "Documents", section: "documents", url: "/management/documents" },
      { title: "Parameters", section: "parameters", url: "/management/parameters" },
      { title: "Fields", section: "fields", url: "/management/fields" },
    ],
  },
  {
    title: "Intelligence",
    section: "intelligence",
    icon: "Sparkles",
    url: "/intelligence/agents",
    order: 6,
    items: [
      { title: "Agents", section: "agents", url: "/intelligence/agents" },
      { title: "Models", section: "models", url: "/intelligence/models" },
      { title: "Providers", section: "providers", url: "/intelligence/providers" },
      { title: "Tools", section: "tools", url: "/intelligence/tools" },
    ],
  },
  {
    title: "System",
    section: "system",
    icon: "Server",
    url: "/system/departments",
    order: 7,
    items: [
      { title: "Departments", section: "departments", url: "/system/departments" },
      { title: "Rubrics", section: "rubrics", url: "/system/rubrics" },
      { title: "Auth", section: "auth", url: "/system/auth" },
      { title: "Evals", section: "evals", url: "/system/evals" },
    ],
  },
  {
    title: "Health",
    section: "health",
    icon: "Activity",
    url: "/health",
    order: 8,
  },
  {
    title: "Benchmark",
    section: "benchmark",
    icon: "Gauge",
    url: "/benchmark",
    order: 9,
  },
  {
    title: "Settings",
    section: "settings",
    icon: "Settings",
    url: "/settings",
    order: 10,
  },
];

/**
 * Filter sidebar sections by available sections.
 * Returns only sections the user has permission to see.
 */
export function getSidebarSections(availableSections: string[]): SidebarSectionConfig[] {
  const sectionSet = new Set(availableSections);
  return SIDEBAR_SECTIONS.filter((s) => sectionSet.has(s.section));
}
