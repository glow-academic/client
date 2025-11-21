import {
  getAvailableSectionsForRole,
  getFirstAvailableSectionForRole,
  isSectionAvailableForRole,
} from "@/utils/route-permissions";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

// ProfileRole type (matches v3 API)
export type ProfileRole =
  | "superadmin"
  | "admin"
  | "instructional"
  | "ta"
  | "guest";

// Re-export the functions from route-permissions for backward compatibility
export {
  getAvailableSectionsForRole,
  getFirstAvailableSectionForRole,
  isSectionAvailableForRole,
};

/**
 * Check if the current path represents a main screen that should show chat components
 * Main screens are those with 1 or 2 slashes (main sections and their direct children)
 */
export const isMainScreen = (pathname: string): boolean => {
  // Special case: allow /cohorts/new to be treated as a main screen
  if (pathname === "/cohorts/new") {
    return false;
  }

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
export const getSectionRoute = (
  section: string,
  currentPathname?: string,
): string => {
  switch (section) {
    case "home":
      return "/home";

    // Practice route
    case "practice":
      return "/practice";

    // Analytics routes
    case "analytics":
      return "/analytics";
    case "dashboard":
      return "/analytics/dashboard";
    case "reports":
      return "/analytics/reports";
    case "pricing":
      return "/analytics/pricing";
    case "leaderboard":
      return "/analytics/leaderboard";

    case "cohorts":
      // For TA users, redirect to their first cohort sub-item page
      // For other roles, go to the main cohorts page
      if (currentPathname && currentPathname.includes("/cohorts/c/")) {
        // If we're already on a cohort page, stay there
        return currentPathname;
      }
      // For TAs, this will be handled by the sidebar to redirect to first cohort
      // For other roles, go to main cohorts page
      return "/cohorts";

    // Create routes
    case "create":
      return "/create";
    case "scenarios":
      return "/create/scenarios";
    case "simulations":
      return "/create/simulations";
    case "personas":
      return "/create/personas";
    case "documents":
      return "/create/documents";

    // Management routes
    case "management":
      return "/management";
    case "agents":
      return "/management/agents";
    case "departments":
      return "/management/departments";
    case "rubrics":
      return "/management/rubrics";
    case "parameters":
      return "/management/parameters";

    // System routes
    case "system":
      return "/system";
    case "staff":
      return "/system/staff";
    case "models":
      return "/system/models";
    case "feedback":
      return "/system/feedback";
    case "logs":
      return "/system/logs";

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
        // Context-aware routing: if we're currently on a cohort editing page, route to editing
        if (currentPathname && currentPathname.includes("/cohorts/e/")) {
          return `/cohorts/e/${cohortId}`;
        }
        // Default to viewing context
        return `/cohorts/c/${cohortId}`;
      }

      if (section.startsWith("simulation-")) {
        const simulationId = section.replace("simulation-", "");
        return `/create/simulations/s/${simulationId}`;
      }
      if (section.startsWith("scenario-")) {
        const scenarioId = section.replace("scenario-", "");
        return `/create/scenarios/s/${scenarioId}`;
      }
      if (section.startsWith("rubric-")) {
        const rubricId = section.replace("rubric-", "");
        return `/management/rubrics/r/${rubricId}`;
      }
      if (section.startsWith("document-")) {
        const documentId = section.replace("document-", "");
        return `/create/documents/d/${documentId}`;
      }

      if (section.startsWith("chat-")) {
        const chatId = section.replace("chat-", "");
        return `/c/${chatId}`;
      }
      if (section.startsWith("attempt-")) {
        const attemptId = section.replace("attempt-", "");
        // Context-aware routing: if we're currently on a practice page, route to practice
        if (currentPathname && currentPathname.startsWith("/practice")) {
          return `/practice/a/${attemptId}`;
        }
        // Default to home context
        return `/home/a/${attemptId}`;
      }

      if (section.startsWith("parameter-")) {
        const parameterId = section.replace("parameter-", "");
        return `/management/parameters/p/${parameterId}`;
      }
      if (section.startsWith("model-")) {
        const modelId = section.replace("model-", "");
        return `/system/models/${modelId}`;
      }
      if (section.startsWith("profile-")) {
        const profileId = section.replace("profile-", "");
        // Check if we're in reports context or staff context
        if (currentPathname && currentPathname.includes("/analytics/reports")) {
          return `/analytics/reports/p/${profileId}`;
        }
        // Staff editing is now done via modals, so redirect to staff list
        return `/system/staff`;
      }
      if (section.startsWith("department-")) {
        const departmentId = section.replace("department-", "");
        return `/management/departments/d/${departmentId}`;
      }
      if (section.startsWith("persona-")) {
        const personaId = section.replace("persona-", "");
        return `/create/personas/p/${personaId}`;
      }

      // Management dynamic routes
      if (section.startsWith("agent-")) {
        const agentId = section.replace("agent-", "");
        return `/management/agents/a/${agentId}`;
      }

      return "/home"; // Default fallback to home
  }
};

/**
 * Maps a section identifier to its corresponding route path for breadcrumb navigation
 * This is different from getSectionRoute because breadcrumb "Classes" should go to first class, not management
 */
export const getBreadcrumbSectionRoute = (
  section: string,
  _currentPathname?: string,
): string => {
  switch (section) {
    default:
      // Use the regular section route for everything else
      return getSectionRoute(section, _currentPathname);
  }
};

/**
 * Creates a section change handler that navigates to the appropriate route
 */
export const createSectionChangeHandler = (
  router: AppRouterInstance,
  currentPathname?: string,
) => {
  return (section: string) => {
    const route = getSectionRoute(section, currentPathname);
    router.push(route);
  };
};

/**
 * Creates a breadcrumb-specific section change handler
 * This handles the special case where "Classes" breadcrumb should go to first class, not management
 */
export const createBreadcrumbSectionChangeHandler = (
  router: AppRouterInstance,
  currentPathname?: string,
) => {
  return (section: string) => {
    const route = getBreadcrumbSectionRoute(section, currentPathname);
    router.push(route);
  };
};

/**
 * Creates a role-aware section change handler that ensures users can only navigate to allowed sections
 */
export const createRoleAwareSectionChangeHandler = (
  router: AppRouterInstance,
  currentRole: ProfileRole,
  onSectionChange?: (section: string) => void,
  currentPathname?: string,
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
    const route = getSectionRoute(section, currentPathname);
    router.push(route);
  };
};

/**
 * Creates a flexible section change handler with custom onSectionChange callback support
 * This is useful for components that might want to handle section changes differently
 */
export const createFlexibleSectionChangeHandler = (
  router: AppRouterInstance,
  onSectionChange?: (section: string) => void,
  currentPathname?: string,
) => {
  return (section: string) => {
    // If onSectionChange prop is provided, use it (for layout components)
    if (onSectionChange) {
      onSectionChange(section);
      return;
    }

    // Otherwise, handle navigation internally
    const route = getSectionRoute(section, currentPathname);
    router.push(route);
  };
};
