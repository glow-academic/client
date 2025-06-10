import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

/**
 * Maps a section identifier to its corresponding route path
 */
export const getSectionRoute = (section: string): string => {
  switch (section) {
    case 'home':
      return '/home';
    case 'growth':
      return '/growth';

    // Analytics routes
    case 'analytics':
    case 'overview':
      return '/analytics/overview';
    case 'performance':
      return '/analytics/performance';
    case 'reports':
      return '/analytics/reports';
    case 'logs':
      return '/analytics/logs';

    // Create routes
    case 'create':
      return '/create';
    case 'scenarios':
      return '/create/scenarios';
    case 'simulations':
      return '/create/simulations';
    case 'rubrics':
      return '/create/rubrics';

    case 'class':
      return '/classes';

    // Management routes
    case 'management':
      return '/management';
    case 'staff':
      return '/management/staff';
    case 'agents':
      return '/management/agents';
    case 'evals':
      return '/management/evals';
    case 'classes':
      return '/management/classes';

    // Profile route
    case 'profile':
      return '/profile';

    default:
      // Handle dynamic routes with IDs
      if (section.startsWith('class-')) {
        const classId = section.replace('class-', '');
        return `/classes/c/${classId}`;
      }
      if (section.startsWith('simulation-')) {
        const simulationId = section.replace('simulation-', '');
        return `/create/simulations/s/${simulationId}`;
      }
      if (section.startsWith('agent-')) {
        const agentId = section.replace('agent-', '');
        return `/management/agents/a/${agentId}`;
      }
      if (section.startsWith('scenario-')) {
        const scenarioId = section.replace('scenario-', '');
        return `/create/scenarios/s/${scenarioId}`;
      }
      if (section.startsWith('rubric-')) {
        const rubricId = section.replace('rubric-', '');
        return `/create/rubrics/r/${rubricId}`;
      }
      if (section.startsWith('chat-')) {
        const chatId = section.replace('chat-', '');
        return `/c/${chatId}`;
      }
      if (section.startsWith('attempt-')) {
        const attemptId = section.replace('attempt-', '');
        return `/a/${attemptId}`;
      }
      if (section.startsWith('user-')) {
        const userId = section.replace('user-', '');
        return `/management/staff/u/${userId}`;
      }
      if (section.startsWith('eval-')) {
        const evalId = section.replace('eval-', '');
        return `/management/evals/e/${evalId}`;
      }

      return '/home'; // Default fallback to home
  }
};

/**
 * Maps a section identifier to its corresponding route path for breadcrumb navigation
 * This is different from getSectionRoute because breadcrumb "Classes" should go to first class, not management
 */
export const getBreadcrumbSectionRoute = (section: string): string => {
  switch (section) {
    case 'classes':
      // For breadcrumbs, "Classes" should go to the first class, not management
      return '/classes';
    default:
      // Use the regular section route for everything else
      return getSectionRoute(section);
  }
};

/**
 * Creates a section change handler that navigates to the appropriate route
 */
export const createSectionChangeHandler = (
  router: AppRouterInstance,
  defaultRoute: string = '/home'
) => {
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
  router: AppRouterInstance,
  defaultRoute: string = '/home'
) => {
  return (section: string) => {
    const route = getBreadcrumbSectionRoute(section);
    router.push(route);
  };
};

/**
 * Creates a section change handler with custom onSectionChange callback support
 * This is useful for components that might want to handle section changes differently
 */
export const createFlexibleSectionChangeHandler = (
  router: AppRouterInstance,
  onSectionChange?: (section: string) => void,
  defaultRoute: string = '/home'
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