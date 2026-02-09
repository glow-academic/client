/**
 * route-permissions.ts
 * Centralized route permissions configuration for access control
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */

// ProfileRole type (matches v3 API)
export type ProfileRole =
  | "superadmin"
  | "admin"
  | "instructional"
  | "member"
  | "guest"
  | "custom";

export interface RoutePermission {
  path: string;
  roles: ProfileRole[];
  title: string;
  description?: string;
  redirectTo?: string; // Where to redirect if access denied
}

export interface SectionPermission {
  section: string;
  roles: ProfileRole[];
  title: string;
  description?: string;
  routes: RoutePermission[];
}

// Centralized route permissions configuration
export const ROUTE_PERMISSIONS: SectionPermission[] = [
  {
    section: "home",
    roles: ["member", "instructional", "admin", "superadmin"],
    title: "Home",
    description: "Main dashboard for member users",
    routes: [
      {
        path: "/home",
        roles: ["member", "instructional", "admin", "superadmin"],
        title: "Home Dashboard",
        redirectTo: "/home",
      },
      {
        path: "/home/a/[attemptId]",
        roles: ["member", "instructional", "admin", "superadmin"],
        title: "Simulation Attempt",
        redirectTo: "/home",
      },
    ],
  },
  {
    section: "practice",
    roles: ["guest", "member", "instructional", "admin", "superadmin"],
    title: "Practice",
    description: "Practice simulations for all users",
    routes: [
      {
        path: "/practice",
        roles: ["guest", "member", "instructional", "admin", "superadmin"],
        title: "Practice Zone",
        redirectTo: "/practice",
      },
      {
        path: "/practice/a/[attemptId]",
        roles: ["guest", "member", "instructional", "admin", "superadmin"],
        title: "Practice Attempt",
        redirectTo: "/practice",
      },
      {
        path: "/practice/custom",
        roles: ["member", "instructional", "admin", "superadmin"],
        title: "Customize Practice",
        redirectTo: "/practice",
      },
    ],
  },
  {
    section: "analytics",
    roles: ["instructional", "admin", "superadmin"],
    title: "Analytics",
    description: "Analytics and reporting tools",
    routes: [
      {
        path: "/analytics",
        roles: ["instructional", "admin", "superadmin"],
        title: "Analytics Overview",
        redirectTo: "/analytics/dashboard",
      },
      {
        path: "/analytics/dashboard",
        roles: ["instructional", "admin", "superadmin"],
        title: "Analytics Dashboard",
        redirectTo: "/analytics/dashboard",
      },
      {
        path: "/analytics/reports",
        roles: ["instructional", "admin", "superadmin"],
        title: "Analytics Reports",
        redirectTo: "/analytics/reports",
      },
      {
        path: "/analytics/reports/p/[profileId]",
        roles: ["instructional", "admin", "superadmin"],
        title: "Profile Report",
        redirectTo: "/analytics/reports",
      },
      {
        path: "/analytics/activity",
        roles: ["instructional", "admin", "superadmin"],
        title: "Activity",
        redirectTo: "/analytics/activity",
      },
      {
        path: "/analytics/activity/s/[sessionId]",
        roles: ["instructional", "admin", "superadmin"],
        title: "Session",
        redirectTo: "/analytics/activity",
      },
      {
        path: "/analytics/pricing",
        roles: ["instructional", "admin", "superadmin"],
        title: "Pricing",
        redirectTo: "/analytics/pricing",
      },
      {
        path: "/analytics/pricing/r/[runId]",
        roles: ["instructional", "admin", "superadmin"],
        title: "Run",
        redirectTo: "/analytics/pricing",
      },
      {
        path: "/analytics/pricing/g/[groupRunId]",
        roles: ["instructional", "admin", "superadmin"],
        title: "Group",
        redirectTo: "/analytics/pricing",
      },
    ],
  },
  {
    section: "training",
    roles: ["instructional", "admin", "superadmin"],
    title: "Training",
    description: "Training content tools",
    routes: [
      {
        path: "/training",
        roles: ["instructional", "admin", "superadmin"],
        title: "Training Overview",
        redirectTo: "/training/personas",
      },
      {
        path: "/training/personas",
        roles: ["instructional", "admin", "superadmin"],
        title: "Personas",
        redirectTo: "/training/personas",
      },
      {
        path: "/training/personas/new",
        roles: ["instructional", "admin", "superadmin"],
        title: "Create Persona",
        redirectTo: "/training/personas",
      },
      {
        path: "/training/personas/p/[personaId]",
        roles: ["instructional", "admin", "superadmin"],
        title: "Edit Persona",
        redirectTo: "/training/personas",
      },
      {
        path: "/training/scenarios",
        roles: ["instructional", "admin", "superadmin"],
        title: "Scenarios",
        redirectTo: "/training/scenarios",
      },
      {
        path: "/training/scenarios/new",
        roles: ["instructional", "admin", "superadmin"],
        title: "Create Scenario",
        redirectTo: "/training/scenarios",
      },
      {
        path: "/training/scenarios/s/[scenarioId]",
        roles: ["instructional", "admin", "superadmin"],
        title: "Edit Scenario",
        redirectTo: "/training/scenarios",
      },
      {
        path: "/training/simulations",
        roles: ["instructional", "admin", "superadmin"],
        title: "Simulations",
        redirectTo: "/training/simulations",
      },
      {
        path: "/training/simulations/new",
        roles: ["instructional", "admin", "superadmin"],
        title: "Create Simulation",
        redirectTo: "/training/simulations",
      },
      {
        path: "/training/simulations/s/[simulationId]",
        roles: ["instructional", "admin", "superadmin"],
        title: "Edit Simulation",
        redirectTo: "/training/simulations",
      },
      {
        path: "/training/cohorts",
        roles: ["instructional", "admin", "superadmin"],
        title: "Cohorts Management",
        redirectTo: "/training/cohorts",
      },
      {
        path: "/training/cohorts/new",
        roles: ["instructional", "admin", "superadmin"],
        title: "Create Cohort",
        redirectTo: "/training/cohorts",
      },
      {
        path: "/training/cohorts/c/[cohortId]",
        roles: ["instructional", "admin", "superadmin"],
        title: "Edit Cohort",
        redirectTo: "/training/cohorts",
      },
    ],
  },
  {
    section: "leaderboard",
    roles: ["member", "instructional", "admin", "superadmin"],
    title: "Leaderboard",
    description: "Performance leaderboard and rankings",
    routes: [
      {
        path: "/leaderboard",
        roles: ["member", "instructional", "admin", "superadmin"],
        title: "Leaderboard",
        redirectTo: "/leaderboard",
      },
    ],
  },
  {
    section: "management",
    roles: ["admin", "superadmin"],
    title: "Management",
    description: "System management tools",
    routes: [
      {
        path: "/management",
        roles: ["admin", "superadmin"],
        title: "Management Overview",
        redirectTo: "/management/staff",
      },
      {
        path: "/management/staff",
        roles: ["superadmin"],
        title: "Staff Management",
        redirectTo: "/management/staff",
      },
      {
        path: "/management/staff/new",
        roles: ["superadmin"],
        title: "Create Staff",
        redirectTo: "/management/staff",
      },
      {
        path: "/management/staff/p/[profileId]",
        roles: ["superadmin"],
        title: "Staff Profile",
        redirectTo: "/management/staff",
      },
      {
        path: "/management/documents",
        roles: ["admin", "superadmin"],
        title: "Documents",
        redirectTo: "/management/documents",
      },
      {
        path: "/management/documents/new",
        roles: ["admin", "superadmin"],
        title: "Create Document",
        redirectTo: "/management/documents",
      },
      {
        path: "/management/documents/d/[documentId]",
        roles: ["admin", "superadmin"],
        title: "Edit Document",
        redirectTo: "/management/documents",
      },
      {
        path: "/management/parameters",
        roles: ["admin", "superadmin"],
        title: "Parameters",
        redirectTo: "/management/parameters",
      },
      {
        path: "/management/parameters/new",
        roles: ["admin", "superadmin"],
        title: "Create Parameter",
        redirectTo: "/management/parameters",
      },
      {
        path: "/management/parameters/p/[parameterId]",
        roles: ["admin", "superadmin"],
        title: "Edit Parameter",
        redirectTo: "/management/parameters",
      },
      {
        path: "/management/fields",
        roles: ["admin", "superadmin"],
        title: "Fields",
        redirectTo: "/management/fields",
      },
      {
        path: "/management/fields/new",
        roles: ["admin", "superadmin"],
        title: "Create Field",
        redirectTo: "/management/fields",
      },
      {
        path: "/management/fields/[fieldId]",
        roles: ["admin", "superadmin"],
        title: "Edit Field",
        redirectTo: "/management/fields",
      },
    ],
  },
  {
    section: "intelligence",
    roles: ["superadmin"],
    title: "Intelligence",
    description: "Intelligence configuration tools",
    routes: [
      {
        path: "/intelligence",
        roles: ["superadmin"],
        title: "Intelligence Overview",
        redirectTo: "/intelligence/agents",
      },
      {
        path: "/intelligence/agents",
        roles: ["superadmin"],
        title: "Agents",
        redirectTo: "/intelligence/agents",
      },
      {
        path: "/intelligence/agents/new",
        roles: ["superadmin"],
        title: "Create Agent",
        redirectTo: "/intelligence/agents",
      },
      {
        path: "/intelligence/agents/a/[agentId]",
        roles: ["superadmin"],
        title: "Edit Agent",
        redirectTo: "/intelligence/agents",
      },
      {
        path: "/intelligence/models",
        roles: ["superadmin"],
        title: "Models",
        redirectTo: "/intelligence/models",
      },
      {
        path: "/intelligence/models/new",
        roles: ["superadmin"],
        title: "Create Model",
        redirectTo: "/intelligence/models",
      },
      {
        path: "/intelligence/models/[modelId]",
        roles: ["superadmin"],
        title: "Edit Model",
        redirectTo: "/intelligence/models",
      },
      {
        path: "/intelligence/providers",
        roles: ["superadmin"],
        title: "Providers",
        redirectTo: "/intelligence/providers",
      },
      {
        path: "/intelligence/providers/new",
        roles: ["superadmin"],
        title: "Create Provider",
        redirectTo: "/intelligence/providers",
      },
      {
        path: "/intelligence/providers/p/[providerId]",
        roles: ["superadmin"],
        title: "Edit Provider",
        redirectTo: "/intelligence/providers",
      },
      {
        path: "/intelligence/tools",
        roles: ["superadmin"],
        title: "Tools",
        redirectTo: "/intelligence/tools",
      },
      {
        path: "/intelligence/tools/new",
        roles: ["superadmin"],
        title: "Create Tool",
        redirectTo: "/intelligence/tools",
      },
      {
        path: "/intelligence/tools/t/[toolId]",
        roles: ["superadmin"],
        title: "Edit Tool",
        redirectTo: "/intelligence/tools",
      },
    ],
  },
  {
    section: "system",
    roles: ["superadmin"],
    title: "System",
    description: "System administration tools",
    routes: [
      {
        path: "/system",
        roles: ["superadmin"],
        title: "System Overview",
        redirectTo: "/system/departments",
      },
      {
        path: "/system/auth",
        roles: ["superadmin"],
        title: "Auth",
        redirectTo: "/system/auth",
      },
      {
        path: "/system/auth/new",
        roles: ["superadmin"],
        title: "Create Auth",
        redirectTo: "/system/auth",
      },
      {
        path: "/system/auth/a/[authId]",
        roles: ["superadmin"],
        title: "Edit Auth",
        redirectTo: "/system/auth",
      },
      {
        path: "/system/evals",
        roles: ["superadmin"],
        title: "Evals",
        redirectTo: "/system/evals",
      },
      {
        path: "/system/evals/new",
        roles: ["superadmin"],
        title: "Create Eval",
        redirectTo: "/system/evals",
      },
      {
        path: "/system/evals/e/[evalId]",
        roles: ["superadmin"],
        title: "Edit Eval",
        redirectTo: "/system/evals",
      },
      {
        path: "/system/departments",
        roles: ["instructional", "admin", "superadmin"],
        title: "Departments",
        redirectTo: "/system/departments",
      },
      {
        path: "/system/departments/new",
        roles: ["instructional", "admin", "superadmin"],
        title: "Create Department",
        redirectTo: "/system/departments",
      },
      {
        path: "/system/departments/d/[departmentId]",
        roles: ["instructional", "admin", "superadmin"],
        title: "Edit Department",
        redirectTo: "/system/departments",
      },
      {
        path: "/system/rubrics",
        roles: ["superadmin"],
        title: "Rubrics",
        redirectTo: "/system/rubrics",
      },
      {
        path: "/system/rubrics/new",
        roles: ["superadmin"],
        title: "Create Rubric",
        redirectTo: "/system/rubrics",
      },
      {
        path: "/system/rubrics/r/[rubricId]",
        roles: ["superadmin"],
        title: "Edit Rubric",
        redirectTo: "/system/rubrics",
      },
    ],
  },
  {
    section: "health",
    roles: ["superadmin"],
    title: "Health",
    description: "System health monitoring",
    routes: [
      {
        path: "/health",
        roles: ["superadmin"],
        title: "System Health",
        redirectTo: "/health",
      },
    ],
  },
  {
    section: "benchmark",
    roles: ["superadmin", "custom"],
    title: "Benchmark",
    description: "Run and manage evaluations",
    routes: [
      {
        path: "/benchmark",
        roles: ["superadmin", "custom"],
        title: "Benchmark",
        redirectTo: "/benchmark",
      },
      {
        path: "/benchmark/er/[eval_run_id]",
        roles: ["superadmin", "custom"],
        title: "Evaluation Run",
        redirectTo: "/benchmark",
      },
    ],
  },
  {
    section: "settings",
    roles: ["admin", "superadmin"],
    title: "Settings",
    description: "System settings and configuration",
    routes: [
      {
        path: "/settings",
        roles: ["admin", "superadmin"],
        title: "Settings",
        redirectTo: "/settings",
      },
    ],
  },
];

// Helper function to check if a user has access to a specific path
export const hasRouteAccess = (
  pathname: string,
  role: ProfileRole,
): boolean => {
  // Handle dynamic routes by converting them to pattern matches
  const normalizedPath = normalizePathForMatching(pathname);

  for (const section of ROUTE_PERMISSIONS) {
    for (const route of section.routes) {
      if (
        routeMatches(route.path, normalizedPath) &&
        route.roles.includes(role)
      ) {
        return true;
      }
    }
  }

  return false;
};

// Helper function to get route permission for a specific path
export const getRoutePermission = (
  pathname: string,
): RoutePermission | null => {
  const normalizedPath = normalizePathForMatching(pathname);

  for (const section of ROUTE_PERMISSIONS) {
    for (const route of section.routes) {
      if (routeMatches(route.path, normalizedPath)) {
        return route;
      }
    }
  }

  return null;
};

// Helper function to get section permission for a specific path
export const getSectionPermission = (
  pathname: string,
): SectionPermission | null => {
  const normalizedPath = normalizePathForMatching(pathname);

  for (const section of ROUTE_PERMISSIONS) {
    for (const route of section.routes) {
      if (routeMatches(route.path, normalizedPath)) {
        return section;
      }
    }
  }

  return null;
};

// Helper function to get the redirect path for a user when access is denied
export const getRedirectPathForRole = (role: ProfileRole): string => {
  switch (role) {
    case "guest":
      return "/practice"; // Guest users can access practice
    case "member":
      return "/home"; // Member users start at home
    case "instructional":
    case "admin":
    case "superadmin":
      return "/analytics/dashboard"; // Staff and admins start at analytics dashboard
    case "custom":
      return "/benchmark";
    default:
      // For unknown roles, try to determine a safe default based on available sections
      // This prevents incorrect redirects to practice page
      if (role && typeof role === "string") {
        // If we have a role but it's not in our switch, check if it's a valid role
        const validRoles = [
          "guest",
          "member",
          "instructional",
          "admin",
          "superadmin",
          "custom",
        ];
        if (validRoles.includes(role)) {
          // Fallback to home for valid but unhandled roles
          return "/home";
        }
      }
      // Ultimate fallback - should rarely happen
      return "/home";
  }
};

// Helper function to normalize path for matching (handles dynamic segments)
const normalizePathForMatching = (pathname: string): string => {
  // Remove leading slash and normalize
  let normalized = pathname.startsWith("/") ? pathname.slice(1) : pathname;

  // Convert dynamic segments to pattern format
  normalized = normalized.replace(/\/\[[^\]]+\]/g, "/[id]");

  return normalized;
};

// Helper function to check if a route pattern matches a normalized path
const routeMatches = (pattern: string, normalizedPath: string): boolean => {
  // Remove leading slash from pattern
  const cleanPattern = pattern.startsWith("/")
    ? pattern.slice(1) || ""
    : pattern;

  // Convert pattern to regex
  const regexPattern = cleanPattern
    .replace(/\/\[[^\]]+\]/g, "/[^/]+") // Replace [id] with regex
    .replace(/\//g, "\\/"); // Escape forward slashes

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(normalizedPath);
};

// Helper function to get all available sections for a role
export const getAvailableSectionsForRole = (role: ProfileRole): string[] => {
  const sections = new Set<string>();

  for (const section of ROUTE_PERMISSIONS) {
    if (section.roles.includes(role)) {
      sections.add(section.section);
    }
  }

  return Array.from(sections);
};

// Helper function to get all available subsections for a role (including individual route sections)
export const getAvailableSubsectionsForRole = (role: ProfileRole): string[] => {
  const subsections = new Set<string>();

  for (const section of ROUTE_PERMISSIONS) {
    if (section.roles.includes(role)) {
      // Add the main section
      subsections.add(section.section);

      // Add all subsections from routes
      for (const route of section.routes) {
        // Extract subsection from route path
        const pathParts = route.path.split("/").filter(Boolean);
        if (pathParts.length >= 2 && pathParts[1]) {
          // For paths like "/analytics/dashboard", add "dashboard"
          // For paths like "/create/personas", add "personas"
          subsections.add(pathParts[1]);
        }
      }
    }
  }

  return Array.from(subsections);
};

// Helper function to check if a section is available for a role
export const isSectionAvailableForRole = (
  section: string,
  role: ProfileRole,
): boolean => {
  return getAvailableSectionsForRole(role).includes(section);
};

// Helper function to get the first available section for a role
export const getFirstAvailableSectionForRole = (role: ProfileRole): string => {
  const availableSections = getAvailableSectionsForRole(role);

  if (availableSections.length === 0) {
    return "home";
  }

  // Priority order for first section
  const priorityOrder = [
    "home",
    "dashboard",
    "analytics",
    "training",
    "management",
    "intelligence",
    "system",
  ];

  for (const priority of priorityOrder) {
    if (availableSections.includes(priority)) {
      return priority;
    }
  }

  return availableSections[0] || "home";
};
