import { profileRole } from "@/utils/drizzle/schema";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
type ProfileRole = (typeof profileRole.enumValues)[number];

/**
 * Get the first available section for a given role
 * This determines where users should be navigated when switching roles
 */
export const getFirstAvailableSectionForRole = (role: ProfileRole): string => {
  switch (role) {
    case "guest":
    case "ta":
      return "home";
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
      sections.push("home", "classes", "cohorts");
      break;
    case "instructional":
      sections.push(
        "dashboard",
        "reports",
        "progress", // Analytics
        "scenarios",
        "simulations",
        "rubrics", // Create
        "cohorts" // Classes (all)
      );
      break;
    case "admin":
      sections.push(
        "dashboard",
        "reports",
        "progress", // Analytics
        "scenarios",
        "simulations",
        "rubrics", // Create
        "cohorts", // Classes (all)
        "personas",
        "logs",
        "providers", // Management
        "agents",
        "providers",
        "logs",
        "health" // System
      );
      break;
    case "superadmin":
      sections.push(
        "dashboard",
        "reports",
        "progress", // Analytics
        "scenarios",
        "simulations",
        "rubrics", // Create
        "classes",
        "cohorts", // Classes (all)
        "departments",
        "personas",
        "logs",
        "providers", // Management
        "agents",
        "providers",
        "logs",
        "health" // System
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
 * Main screens are those with 1 or 2 slashes (main sections and their direct children)
 */
export const isMainScreen = (pathname: string): boolean => {
  // Remove leading slash and count remaining slashes
  const pathWithoutLeadingSlash = pathname.startsWith("/")
    ? pathname.slice(1)
    : pathname;
  const slashCount = (pathWithoutLeadingSlash.match(/\//g) || []).length;

  // Show chat on pages with 0 or 1 slashes (after removing leading slash)
  // This means:
  // - /analytics (0 slashes after removing leading /)
  // - /analytics/dashboard (1 slash after removing leading /)
  // - /create (0 slashes)
  // - /create/classes (1 slash)
  // - /management (0 slashes)
  // - /management/departments (1 slash)
  // But NOT:
  // - /create/classes/c/123 (3 slashes)
  // - /analytics/reports/p/456 (3 slashes)
  return slashCount <= 1;
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
    case "leaderboard":
      return "/analytics/leaderboard";

    case "cohorts":
      return "/cohorts";

    // Create routes
    case "create":
      return "/create";
    case "scenarios":
      return "/create/scenarios";
    case "simulations":
      return "/create/simulations";
    case "rubrics":
      return "/create/rubrics";
    case "personas":
      return "/create/personas";

    // Management routes
    case "management":
      return "/management";
    case "context":
      return "/management/context";
    case "staff":
      return "/management/staff";
    case "providers":
      return "/system/providers";
    case "activity":
      return "/management/activity";
    case "feedback":
      return "/management/feedback";
    case "system":
      return "/management/system";

    // System routes
    case "agents":
      return "/system/agents";
    case "providers":
      return "/system/providers";
    case "logs":
      return "/system/logs";
    case "health":
      return "/system/health";

    // Profile route
    case "profile":
      return "/profile";

    default:
      // Handle dynamic routes with IDs
      if (section.startsWith("class-")) {
        const classId = section.replace("class-", "");
        return `/classes/c/${classId}`;
      }

      if (section.startsWith("cohort-")) {
        const cohortId = section.replace("cohort-", "");
        return `/cohorts/c/${cohortId}`;
      }

      if (section.startsWith("simulation-")) {
        const simulationId = section.replace("simulation-", "");
        return `/create/simulations/s/${simulationId}`;
      }
      if (section.startsWith("agent-")) {
        const agentId = section.replace("agent-", "");
        return `/create/agents/a/${agentId}`;
      }
      if (section.startsWith("scenario-")) {
        const scenarioId = section.replace("scenario-", "");
        return `/create/scenarios/s/${scenarioId}`;
      }
      if (section.startsWith("rubric-")) {
        const rubricId = section.replace("rubric-", "");
        return `/create/rubrics/r/${rubricId}`;
      }

      if (section.startsWith("chat-")) {
        const chatId = section.replace("chat-", "");
        return `/c/${chatId}`;
      }
      if (section.startsWith("attempt-")) {
        const attemptId = section.replace("attempt-", "");
        return `/home/a/${attemptId}`;
      }

      if (section.startsWith("provider-")) {
        const providerId = section.replace("provider-", "");
        return `/system/providers/p/${providerId}`;
      }
      if (section.startsWith("model-")) {
        const providerId = section.replace("provider-", "");
        const modelId = section.replace("model-", "");
        return `/system/providers/p/${providerId}/m/${modelId}`;
      }
      if (section.startsWith("report-")) {
        const profileId = section.replace("report-", "");
        return `/analytics/reports/p/${profileId}`;
      }

      // System dynamic routes
      if (section.startsWith("agent-")) {
        const agentId = section.replace("agent-", "");
        return `/system/agents/a/${agentId}`;
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
