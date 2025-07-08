import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

type ProfileRole = "admin" | "instructional" | "instructor" | "ta" | "guest";

/**
 * Get the first available section for a given role
 * This determines where users should be navigated when switching roles
 */
export const getFirstAvailableSectionForRole = (role: ProfileRole): string => {
  switch (role) {
    case "guest":
    case "ta":
      return "home";
    case "instructor":
      return "dashboard"; // Analytics overview
    case "instructional":
      return "dashboard"; // Analytics overview
    case "admin":
      return "dashboard"; // Analytics overview
    default:
      return "home";
  }
};

/**
 * Get all available sections for a given role
 * This helps determine what sections a user can access
 */
export const getAvailableSectionsForRole = (role: ProfileRole): string[] => {
  const sections: string[] = [];

  switch (role) {
    case "guest":
      sections.push("home");
      break;
    case "ta":
      sections.push("home");
      break;
    case "instructor":
      sections.push(
        "dashboard",
        "reports",
        "history", // Analytics
        "scenarios",
        "simulations",
        "rubrics", // Create
        "classes" // Classes (filtered by assignment)
      );
      break;
    case "instructional":
      sections.push(
        "dashboard",
        "reports",
        "history", // Analytics
        "scenarios",
        "simulations",
        "rubrics", // Create
        "classes",
        "cohorts" // Classes (all)
      );
      break;
    case "admin":
      sections.push(
        "dashboard",
        "reports",
        "history", // Analytics
        "scenarios",
        "simulations",
        "rubrics", // Create
        "classes",
        "cohorts", // Classes (all)
        "staff",
        "agents",
        "logs",
        "models" // Management
      );
      break;
  }

  // All roles can access profile
  sections.push("profile");

  return sections;
};

/**
 * Check if a section is available for a given role
 */
export const isSectionAvailableForRole = (
  section: string,
  role: ProfileRole
): boolean => {
  const availableSections = getAvailableSectionsForRole(role);

  // Handle dynamic sections (class-*, agent-*, etc.)
  if (section && section.includes("-")) {
    const baseSection = section.split("-")[0];
    return availableSections.some((s) => s.startsWith(baseSection || ""));
  }

  return availableSections.includes(section);
};

/**
 * Check if the current path represents a main screen that should show chat components
 * Main screens are those defined in the sidebar navigation for the user's role
 */
export const isMainScreen = (pathname: string, role: ProfileRole): boolean => {
  // Get the active section from the path
  const segments = pathname.split("/").filter(Boolean);

  // Handle root path
  if (segments.length === 0) return false;

  const [first, second] = segments;

  // Determine the base section
  let baseSection = "";

  switch (first) {
    case "home":
      baseSection = "home";
      break;
    case "analytics":
      baseSection = second || "dashboard"; // dashboard, reports, history
      break;
    case "create":
      if (second === "classes") {
        baseSection = "classes";
      } else if (second === "cohorts") {
        baseSection = "cohorts";
      } else if (second === "scenarios") {
        baseSection = "scenarios";
      } else if (second === "simulations") {
        baseSection = "simulations";
      } else {
        baseSection = "create";
      }
      break;
    case "management":
      if (second === "staff") {
        baseSection = "staff";
      } else if (second === "agents") {
        baseSection = "agents";
      } else if (second === "models") {
        baseSection = "models";
      } else if (second === "logs") {
        baseSection = "logs";
      } else if (second === "rubrics") {
        baseSection = "rubrics";
      } else {
        baseSection = "management";
      }
      break;
    case "profile":
      baseSection = "profile";
      break;
    default:
      return false;
  }

  // Check if this base section is available for the user's role
  return isSectionAvailableForRole(baseSection, role);
};

/**
 * Maps a section identifier to its corresponding route path
 */
export const getSectionRoute = (section: string): string => {
  switch (section) {
    case "home":
      return "/home";

    // Analytics routes
    case "analytics":
      return "/analytics";
    case "dashboard":
      return "/analytics/dashboard";
    case "reports":
      return "/analytics/reports";
    case "history":
      return "/analytics/history";

    // Create routes
    case "create":
      return "/create";
    case "scenarios":
      return "/create/scenarios";
    case "simulations":
      return "/create/simulations";
    case "rubrics":
      return "/management/rubrics";
    case "classes":
      return "/create/classes";
    case "cohorts":
      return "/create/cohorts";

    // Management routes
    case "management":
      return "/management";
    case "staff":
      return "/management/staff";
    case "agents":
      return "/management/agents";
    case "models":
      return "/management/models";
    case "logs":
      return "/management/logs";

    // Profile route
    case "profile":
      return "/profile";

    default:
      // Handle dynamic routes with IDs
      if (section.startsWith("class-")) {
        const classId = section.replace("class-", "");
        return `/create/classes/c/${classId}`;
      }
      if (section.startsWith("simulation-")) {
        const simulationId = section.replace("simulation-", "");
        return `/create/simulations/s/${simulationId}`;
      }
      if (section.startsWith("agent-")) {
        const agentId = section.replace("agent-", "");
        return `/management/agents/a/${agentId}`;
      }
      if (section.startsWith("scenario-")) {
        const scenarioId = section.replace("scenario-", "");
        return `/create/scenarios/s/${scenarioId}`;
      }
      if (section.startsWith("rubric-")) {
        const rubricId = section.replace("rubric-", "");
        return `/management/rubrics/r/${rubricId}`;
      }
      if (section.startsWith("chat-")) {
        const chatId = section.replace("chat-", "");
        return `/c/${chatId}`;
      }
      if (section.startsWith("attempt-")) {
        const attemptId = section.replace("attempt-", "");
        return `/home/a/${attemptId}`;
      }
      if (section.startsWith("user-")) {
        const userId = section.replace("user-", "");
        return `/management/staff/u/${userId}`;
      }
      if (section.startsWith("profile-")) {
        const profileId = section.replace("profile-", "");
        return `/management/staff/p/${profileId}`;
      }
      if (section.startsWith("eval-")) {
        const evalId = section.replace("eval-", "");
        return `/management/evals/e/${evalId}`;
      }
      if (section.startsWith("cohort-")) {
        const cohortId = section.replace("cohort-", "");
        return `/create/cohorts/c/${cohortId}`;
      }
      if (section.startsWith("model-")) {
        const modelId = section.replace("model-", "");
        return `/management/models/m/${modelId}`;
      }
      if (section.startsWith("report-")) {
        const profileId = section.replace("report-", "");
        return `/analytics/reports/p/${profileId}`;
      }

      return "/home"; // Default fallback to home
  }
};

/**
 * Maps a section identifier to its corresponding route path for breadcrumb navigation
 * This is different from getSectionRoute because breadcrumb "Classes" should go to first class, not management
 */
export const getBreadcrumbSectionRoute = (section: string): string => {
  switch (section) {
    case "classes":
      // For breadcrumbs, "Classes" should go to the create classes page
      return "/create/classes";
    default:
      // Use the regular section route for everything else
      return getSectionRoute(section);
  }
};

/**
 * Creates a section change handler that navigates to the appropriate route
 */
export const createSectionChangeHandler = (router: AppRouterInstance) => {
  return (section: string) => {
    const route = getSectionRoute(section);
    router.push(route);
  };
};

/**
 * Creates a breadcrumb-specific section change handler
 * This handles the special case where "Classes" breadcrumb should go to first class, not management
 */
export const createBreadcrumbSectionChangeHandler = (
  router: AppRouterInstance
) => {
  return (section: string) => {
    const route = getBreadcrumbSectionRoute(section);
    router.push(route);
  };
};

/**
 * Creates a role-aware section change handler that ensures users can only navigate to allowed sections
 */
export const createRoleAwareSectionChangeHandler = (
  router: AppRouterInstance,
  currentRole: ProfileRole,
  onSectionChange?: (section: string) => void
) => {
  return (section: string) => {
    // Check if the section is available for the current role
    if (!isSectionAvailableForRole(section, currentRole)) {
      // If not available, navigate to the first available section for this role
      const fallbackSection = getFirstAvailableSectionForRole(currentRole);
      section = fallbackSection;
    }

    // If onSectionChange prop is provided, use it (for layout components)
    if (onSectionChange) {
      onSectionChange(section);
      return;
    }

    // Otherwise, handle navigation internally
    const route = getSectionRoute(section);
    router.push(route);
  };
};

/**
 * Creates a flexible section change handler with custom onSectionChange callback support
 * This is useful for components that might want to handle section changes differently
 */
export const createFlexibleSectionChangeHandler = (
  router: AppRouterInstance,
  onSectionChange?: (section: string) => void
) => {
  return (section: string) => {
    // If onSectionChange prop is provided, use it (for layout components)
    if (onSectionChange) {
      onSectionChange(section);
      return;
    }

    // Otherwise, handle navigation internally
    const route = getSectionRoute(section);
    router.push(route);
  };
};
