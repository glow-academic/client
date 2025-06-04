import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

/**
 * Maps a section identifier to its corresponding route path
 */
export const getSectionRoute = (section: string): string => {
  switch (section) {
    case 'chats':
      return '/dashboard/chats';
    case 'history':
      return '/dashboard/history';
    case 'analytics':
      return '/dashboard/analytics';
    case 'growth':
      return '/dashboard/growth';
    case 'rubric':
      return '/dashboard/rubric';
    case 'profile':
      return '/profile';
    case 'chat-templates':
      return '/chat/templates';
    case 'chat-profiles':
      return '/chat/profiles';
    case 'chat-scenarios':
      return '/chat/scenarios';
    case 'add-class':
      return '/classes/general';
    case 'manage-instructional':
      return '/management/instructional';
    case 'manage-instructors':
      return '/management/instructor';
    case 'manage-tas':
      return '/management/ta';
    default:
      if (section.startsWith('class-')) {
        const classId = section.replace('class-', '');
        return `/classes/c/${classId}`;
      }
      return '/dashboard/chats'; // Default fallback
  }
};

/**
 * Creates a section change handler that navigates to the appropriate route
 */
export const createSectionChangeHandler = (
  router: AppRouterInstance,
  defaultRoute: string = '/dashboard/chats'
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
  defaultRoute: string = '/dashboard/chats'
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