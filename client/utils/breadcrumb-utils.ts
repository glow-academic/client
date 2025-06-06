import { getClass } from "@/utils/queries/get-class";
import { getAttempt } from "@/utils/queries/get-attempt";
import { getScenario } from "@/utils/queries/get-scenario";
import { getAgent } from "@/utils/queries/get-agent";
import { getSimulation } from "@/utils/queries/get-simulation";
import { getChat } from "@/utils/queries/get-chat";

interface BreadcrumbItem {
  title: string;
  section?: string;
}

// Helper function to determine if a segment should be dropped (single digit or single letter)
const shouldDropSegment = (segment: string): boolean => {
  return /^\d$/.test(segment) || /^\w$/.test(segment); // Single digit or single letter
};

// Helper function to fetch actual name for an ID based on context
const fetchNameForId = async (id: string, context: string): Promise<string> => {
  try {
    switch (context) {
      case 'class':
        const classData = await getClass(id);
        return classData?.classCode || `Class ${id.substring(0, 8)}...`;
      
      case 'attempt':
        const attemptData = await getAttempt(id);
        // get simulation for attempt
        const attemptSimulation = await getSimulation(attemptData?.simulationId);
        // Attempts don't have a title, so we'll use a generic name with timestamp
        return attemptSimulation ? `${attemptSimulation.title}` : `Attempt ${id.substring(0, 8)}...`;
      
      case 'scenario':
        const scenarioData = await getScenario(id);
        return scenarioData?.name || `Scenario ${id.substring(0, 8)}...`;
      
      case 'agent':
        const agentData = await getAgent(id);
        return agentData?.name || `Agent ${id.substring(0, 8)}...`;
      
      case 'simulation':
        const simulationData = await getSimulation(id);
        return simulationData?.title || `Simulation ${id.substring(0, 8)}...`;
      
      case 'chat':
        const chatData = await getChat(id);
        return chatData?.title || `Chat ${id.substring(0, 8)}...`;
      
      default:
        return id.length > 10 ? `${id.substring(0, 8)}...` : id;
    }
  } catch (error) {
    console.error(`Error fetching name for ${context} ID ${id}:`, error);
    return id.length > 10 ? `${id.substring(0, 8)}...` : id;
  }
};

// Enhanced breadcrumb generation with async ID resolution
export const generateEnhancedBreadcrumbs = async (pathname: string): Promise<BreadcrumbItem[]> => {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    
    // Skip single digit segments
    if (shouldDropSegment(segment)) {
      continue;
    }
    
    // Determine context for ID resolution
    let context = '';
    let title = segment;
    
    // Check if this is an ID that needs resolution
    const isLikelyId = segment.length > 10 || /^[a-f0-9-]{8,}/.test(segment);
    
    if (isLikelyId) {
      // Determine context based on previous segments or route structure
      const prevSegment = i > 0 ? segments[i - 1] : '';
      const route = segments[0];
      
      switch (route) {
        case 'classes':
          if (prevSegment === 'c') context = 'class';
          break;
        case 'chat':
          if (prevSegment === 't') context = 'simulation';
          else if (prevSegment === 'p') context = 'agent';
          else if (prevSegment === 's') context = 'scenario';
          break;
        case 'c':
          context = 'chat';
          break;
        case 'a':
          context = 'attempt';
          break;
      }
      
      if (context) {
        title = await fetchNameForId(segment, context);
      }
    } else {
      // Convert segment to readable title for non-IDs
      switch (segment) {
        case 'chat':
          title = 'Chat';
          break;
        case 'simulations':
          title = 'Simulations';
          break;
        case 'profiles':
        case 'agents':
          title = 'Agents';
          break;
        case 'scenarios':
          title = 'Scenarios';
          break;
        case 'classes':
          title = 'Classes';
          break;
        case 'general':
          title = 'General';
          break;
        case 'management':
          title = 'Management';
          break;
        case 'instructional':
          title = 'Instructional Staff';
          break;
        case 'instructor':
          title = 'Instructors';
          break;
        case 'ta':
          title = 'Teaching Assistants';
          break;
        case 'profile':
          title = 'Profile';
          break;
        case 'new':
          title = 'New';
          break;
        case 's':
          title = 'Simulation';
          break;
        case 'a':
          title = 'Agent';
          break;
        case 's':
          title = 'Scenario';
          break;
        default:
          title = segment.charAt(0).toUpperCase() + segment.slice(1);
      }
    }
    
    breadcrumbs.push({
      title,
      section: getSectionFromSegments(segments.slice(0, i + 1))
    });
  }
  
  return breadcrumbs;
};

// Helper function to get section from path segments (same as before)
const getSectionFromSegments = (segments: string[]) => {
  if (segments.length === 0) return 'home';
  
  const [first, second, third] = segments;
  
  // Handle special cases
  if (first === 'classes' && second === 'general') {
    return 'add-class';
  }
  if (first === 'classes' && second === 'c') {
    return `class-${third}`;
  }
  if (first === 'chat') {
    return `chat-${second}`;
  }
  if (first === 'c') {
    return 'history'; // Chat pages should be under history section
  }
  if (first === 'a') {
    return 'simulations'; // Attempt pages should be under simulations section
  }
  if (first === 'management') {
    return `manage-${second}`;
  }
  if (first === 'profile') {
    return 'profile';
  }
  
  return segments.join('-');
};

// Synchronous version for cases where async isn't possible (fallback)
export const generateBreadcrumbs = (pathname: string): BreadcrumbItem[] => {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    
    // Skip single digit segments
    if (shouldDropSegment(segment)) {
      continue;
    }
    
    // Convert segment to readable title
    let title = segment;
    switch (segment) {
      case 'chat':
        title = 'Chat';
        break;
      case 'simulations':
        title = 'Simulations';
        break;
      case 'profiles':
      case 'agents':
        title = 'Agents';
        break;
      case 'scenarios':
        title = 'Scenarios';
        break;
      case 'classes':
        title = 'Classes';
        break;
      case 'general':
        title = 'General';
        break;
      case 'management':
        title = 'Management';
        break;
      case 'instructional':
        title = 'Instructional Staff';
        break;
      case 'instructor':
        title = 'Instructors';
        break;
      case 'ta':
        title = 'Teaching Assistants';
        break;
      case 'profile':
        title = 'Profile';
        break;
      case 'new':
        title = 'New';
        break;
      default:
        // For IDs, try to make them more readable
        if (segment.length > 10) {
          title = `ID: ${segment.substring(0, 8)}...`;
        } else {
          title = segment.charAt(0).toUpperCase() + segment.slice(1);
        }
    }
    
    breadcrumbs.push({
      title,
      section: getSectionFromSegments(segments.slice(0, i + 1))
    });
  }
  
  return breadcrumbs;
};

// Helper function to get active section from pathname
export const getActiveSectionFromPath = (pathname: string) => {
  const segments = pathname.split('/').filter(Boolean);
  return getSectionFromSegments(segments);
}; 