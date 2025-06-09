import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

/**
 * Maps a section identifier to its corresponding route path
 */
export const getSectionRoute = (section: string): string => {
  switch (section) {
    // Dashboard routes (now standalone)
    case 'dashboard':
      return '/home'; // Dashboard home is now /home
    case 'growth':
      return '/growth';
    case 'history':
      return '/history';
    case 'rubric':
      return '/rubric';
    
    // Analytics routes
    case 'overview':
      return '/analytics';
    case 'performance':
      return '/analytics/performance';
    case 'reports':
      return '/analytics/reports';
    case 'logs':
      return '/analytics/logs';
    
    // Simulations routes
    case 'simulations':
      return '/simulations';
    case 'rubrics':
      return '/simulations/rubrics';
    
    // Classes routes
    case 'new-class':
      return '/classes/new';
    
    // Management routes
    case 'staff':
      return '/management/staff';
    case 'agents':
      return '/management/agents';
    case 'evals':
      return '/management/evals';
    
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
        return `/simulations/s/${simulationId}`;
      }
      if (section.startsWith('agent-')) {
        const agentId = section.replace('agent-', '');
        return `/simulations/agents/a/${agentId}`;
      }
      if (section.startsWith('scenario-')) {
        const scenarioId = section.replace('scenario-', '');
        return `/simulations/scenarios/s/${scenarioId}`;
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
      
      return '/home'; // Default fallback to home instead of dashboard
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