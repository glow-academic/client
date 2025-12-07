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
  | "ta"
  | "guest";

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
    roles: ["ta", "instructional", "admin", "superadmin"],
    title: "Home",
    description: "Main dashboard for TA users",
    routes: [
      {
        path: "/home",
        roles: ["ta", "instructional", "admin", "superadmin"],
        title: "Home Dashboard",
        redirectTo: "/home",
      },
      {
        path: "/home/a/[attemptId]",
        roles: ["ta", "instructional", "admin", "superadmin"],
        title: "Simulation Attempt",
        redirectTo: "/home",
      },
    ],
  },
  {
    section: "practice",
    roles: ["guest", "ta", "instructional", "admin", "superadmin"],
    title: "Practice",
    description: "Practice simulations for all users",
    routes: [
      {
        path: "/practice",
        roles: ["guest", "ta", "instructional", "admin", "superadmin"],
        title: "Practice Zone",
        redirectTo: "/practice",
      },
      {
        path: "/practice/a/[attemptId]",
        roles: ["guest", "ta", "instructional", "admin", "superadmin"],
        title: "Practice Attempt",
        redirectTo: "/practice",
      },
    ],
  },
  {
    section: "analytics",
    roles: ["ta", "instructional", "admin", "superadmin"],
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
        path: "/analytics/leaderboard",
        roles: ["ta", "instructional", "admin", "superadmin"],
        title: "Leaderboard",
        redirectTo: "/analytics/leaderboard",
      },
      {
        path: "/analytics/reports/p/[profileId]",
        roles: ["instructional", "admin", "superadmin"],
        title: "Profile Report",
        redirectTo: "/analytics/reports",
      },
      {
        path: "/analytics/pricing",
        roles: ["admin", "superadmin"],
        title: "Pricing",
        redirectTo: "/analytics/pricing",
      },
    ],
  },
  {
    section: "departments",
    roles: ["instructional", "admin", "superadmin"],
    title: "Departments",
    description: "Department management",
    routes: [
      {
        path: "/departments",
        roles: ["instructional", "admin", "superadmin"],
        title: "Departments",
        redirectTo: "/departments",
      },
      {
        path: "/departments/new",
        roles: ["instructional", "admin", "superadmin"],
        title: "Create Department",
        redirectTo: "/departments",
      },
      {
        path: "/departments/d/[departmentId]",
        roles: ["instructional", "admin", "superadmin"],
        title: "Edit Department",
        redirectTo: "/departments",
      },
    ],
  },
  {
    section: "cohorts",
    roles: ["ta", "instructional", "admin", "superadmin"],
    title: "Cohorts",
    description: "Cohort management and viewing",
    routes: [
      {
        path: "/cohorts",
        roles: ["instructional", "admin", "superadmin"],
        title: "Cohorts Management",
        redirectTo: "/cohorts",
      },
      {
        path: "/cohorts/new",
        roles: ["instructional", "admin", "superadmin"],
        title: "Create Cohort",
        redirectTo: "/cohorts",
      },
      {
        path: "/cohorts/c/[cohortId]",
        roles: ["ta", "instructional", "admin", "superadmin"],
        title: "View Cohort",
        redirectTo: "/cohorts",
      },
      {
        path: "/cohorts/e/[cohortId]",
        roles: ["instructional", "admin", "superadmin"],
        title: "Edit Cohort",
        redirectTo: "/cohorts",
      },
    ],
  },
  {
    section: "create",
    roles: ["instructional", "admin", "superadmin"],
    title: "Create",
    description: "Content creation tools",
    routes: [
      {
        path: "/create",
        roles: ["instructional", "admin", "superadmin"],
        title: "Create Overview",
        redirectTo: "/create/personas",
      },
      {
        path: "/create/personas",
        roles: ["instructional", "admin", "superadmin"],
        title: "Personas",
        redirectTo: "/create/personas",
      },
      {
        path: "/create/personas/new",
        roles: ["instructional", "admin", "superadmin"],
        title: "Create Persona",
        redirectTo: "/create/personas",
      },
      {
        path: "/create/personas/p/[personaId]",
        roles: ["instructional", "admin", "superadmin"],
        title: "Edit Persona",
        redirectTo: "/create/personas",
      },
      {
        path: "/create/scenarios",
        roles: ["instructional", "admin", "superadmin"],
        title: "Scenarios",
        redirectTo: "/create/scenarios",
      },
      {
        path: "/create/scenarios/new",
        roles: ["instructional", "admin", "superadmin"],
        title: "Create Scenario",
        redirectTo: "/create/scenarios",
      },
      {
        path: "/create/scenarios/s/[scenarioId]",
        roles: ["instructional", "admin", "superadmin"],
        title: "Edit Scenario",
        redirectTo: "/create/scenarios",
      },
      {
        path: "/create/simulations",
        roles: ["instructional", "admin", "superadmin"],
        title: "Simulations",
        redirectTo: "/create/simulations",
      },
      {
        path: "/create/simulations/new",
        roles: ["instructional", "admin", "superadmin"],
        title: "Create Simulation",
        redirectTo: "/create/simulations",
      },
      {
        path: "/create/simulations/s/[simulationId]",
        roles: ["instructional", "admin", "superadmin"],
        title: "Edit Simulation",
        redirectTo: "/create/simulations",
      },
      {
        path: "/create/videos",
        roles: ["instructional", "admin", "superadmin"],
        title: "Videos",
        redirectTo: "/create/videos",
      },
      {
        path: "/create/videos/new",
        roles: ["instructional", "admin", "superadmin"],
        title: "Create Video",
        redirectTo: "/create/videos",
      },
      {
        path: "/create/videos/v/[videoId]",
        roles: ["instructional", "admin", "superadmin"],
        title: "Edit Video",
        redirectTo: "/create/videos",
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
    ],
  },
  {
    section: "engine",
    roles: ["admin", "superadmin"],
    title: "Engine",
    description: "Engine configuration tools",
    routes: [
      {
        path: "/engine",
        roles: ["admin", "superadmin"],
        title: "Engine Overview",
        redirectTo: "/engine/agents",
      },
      {
        path: "/engine/agents",
        roles: ["admin", "superadmin"],
        title: "Agents",
        redirectTo: "/engine/agents",
      },
      {
        path: "/engine/agents/new",
        roles: ["admin", "superadmin"],
        title: "Create Agent",
        redirectTo: "/engine/agents",
      },
      {
        path: "/engine/agents/a/[agentId]",
        roles: ["admin", "superadmin"],
        title: "Edit Agent",
        redirectTo: "/engine/agents",
      },
      {
        path: "/engine/models",
        roles: ["admin", "superadmin"],
        title: "Models",
        redirectTo: "/engine/models",
      },
      {
        path: "/engine/models/new",
        roles: ["admin", "superadmin"],
        title: "Create Model",
        redirectTo: "/engine/models",
      },
      {
        path: "/engine/models/[modelId]",
        roles: ["admin", "superadmin"],
        title: "Edit Model",
        redirectTo: "/engine/models",
      },
      {
        path: "/engine/rubrics",
        roles: ["admin", "superadmin"],
        title: "Rubrics",
        redirectTo: "/engine/rubrics",
      },
      {
        path: "/engine/rubrics/new",
        roles: ["admin", "superadmin"],
        title: "Create Rubric",
        redirectTo: "/engine/rubrics",
      },
      {
        path: "/engine/rubrics/r/[rubricId]",
        roles: ["admin", "superadmin"],
        title: "Edit Rubric",
        redirectTo: "/engine/rubrics",
      },
      {
        path: "/engine/evals",
        roles: ["admin", "superadmin"],
        title: "Evals",
        redirectTo: "/engine/evals",
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
        redirectTo: "/system/providers",
      },
      {
        path: "/system/auth",
        roles: ["superadmin"],
        title: "Auth",
        redirectTo: "/system/auth",
      },
      {
        path: "/system/health",
        roles: ["superadmin"],
        title: "System Health",
        redirectTo: "/system/health",
      },
      {
        path: "/system/settings",
        roles: ["superadmin"],
        title: "Settings",
        redirectTo: "/system/settings",
      },
      {
        path: "/system/providers",
        roles: ["superadmin"],
        title: "Providers",
        redirectTo: "/system/providers",
      },
      {
        path: "/system/providers/new",
        roles: ["superadmin"],
        title: "Create Provider",
        redirectTo: "/system/providers",
      },
      {
        path: "/system/providers/p/[providerId]",
        roles: ["superadmin"],
        title: "Edit Provider",
        redirectTo: "/system/providers",
      },
    ],
  },
  {
    section: "profile",
    roles: ["guest", "ta", "instructional", "admin", "superadmin"],
    title: "Profile",
    description: "User profile management",
    routes: [
      {
        path: "/profile",
        roles: ["guest", "ta", "instructional", "admin", "superadmin"],
        title: "User Profile",
        redirectTo: "/profile",
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
    case "ta":
      return "/home"; // TA users start at home
    case "instructional":
    case "admin":
    case "superadmin":
      return "/analytics/dashboard"; // Staff and admins start at analytics dashboard
    default:
      // For unknown roles, try to determine a safe default based on available sections
      // This prevents incorrect redirects to practice page
      if (role && typeof role === "string") {
        // If we have a role but it's not in our switch, check if it's a valid role
        const validRoles = [
          "guest",
          "ta",
          "instructional",
          "admin",
          "superadmin",
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
    "create",
    "management",
    "engine",
    "system",
  ];

  for (const priority of priorityOrder) {
    if (availableSections.includes(priority)) {
      return priority;
    }
  }

  return availableSections[0] || "home";
};
