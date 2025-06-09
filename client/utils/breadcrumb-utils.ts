import { getClass } from "@/utils/queries/classes/get-class";
import { getScenario } from "@/utils/queries/scenarios/get-scenario";
import { getAgent } from "@/utils/queries/agents/get-agent";
import { getSimulation } from "@/utils/queries/simulations/get-simulation";
import { getSimulationAttempt } from "@/utils/queries/simulation_attempts/get-simulationAttempt";
import { getSimulationChat } from "@/utils/queries/simulation_chats/get-simulationChat";
import { getUser } from "@/utils/queries/users/get-user";


interface BreadcrumbItem {
  title: string;
  section?: string;
}

// Helper function to determine if a segment should be dropped (single digit or single letter)
const shouldDropSegment = (segment: string): boolean => {
  return /^[a-z]$/.test(segment); // Single letter segments like 'c', 'a', 's', 'u'
};

// Helper function to fetch actual name for an ID based on context
const fetchNameForId = async (id: string, context: string): Promise<string> => {
  try {
    switch (context) {
      case 'class':
        const classData = await getClass(id);
        return classData?.classCode || `Class ${id.substring(0, 8)}...`;
      
      case 'attempt':
        const attemptData = await getSimulationAttempt(id);
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
        const chatData = await getSimulationChat(id);
        return chatData?.title || `Chat ${id.substring(0, 8)}...`;
      
      case 'user':
        const userData = await getUser(id);
        return userData?.name || `User ${id.substring(0, 8)}...`;
      
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
    const prevSegment = i > 0 ? segments[i - 1] : '';
    const nextSegment = i < segments.length - 1 ? segments[i + 1] : '';
    
    // Skip single letter segments that are just route markers
    if (shouldDropSegment(segment)) {
      continue;
    }
    
    // Determine context for ID resolution
    let context = '';
    let title = segment;
    
    // Check if this is an ID that needs resolution
    const isLikelyId = segment.length > 10 || /^[a-f0-9-]{8,}/.test(segment);
    
    if (isLikelyId) {
      // Determine context based on route structure
      if (prevSegment === 'c' && segments[0] === 'classes') {
        context = 'class';
      } else if (prevSegment === 'c' && segments[0] === 'c') {
        context = 'chat';
      } else if (prevSegment === 'a' && segments[0] === 'a') {
        context = 'attempt';
      } else if (prevSegment === 's' && segments.includes('simulations')) {
        context = 'simulation';
      } else if (prevSegment === 'a' && segments.includes('agents')) {
        context = 'agent';
      } else if (prevSegment === 's' && segments.includes('scenarios')) {
        context = 'scenario';
      } else if (prevSegment === 'u' && segments.includes('staff')) {
        context = 'user';
      }
      
      if (context) {
        title = await fetchNameForId(segment, context);
      }
    } else {
      // Convert segment to readable title for non-IDs
      switch (segment) {
        // Main sections (now standalone)
        case 'home':
          title = 'Home';
          break;
        case 'growth':
          title = 'Growth';
          break;
        case 'history':
          title = 'History';
          break;
        case 'rubric':
          title = 'Rubric';
          break;
        case 'analytics':
          title = 'Analytics';
          break;
        case 'simulations':
          title = 'Simulations';
          break;
        case 'classes':
          title = 'Classes';
          break;
        case 'management':
          title = 'Management';
          break;
        case 'profile':
          title = 'Profile';
          break;
        
        // Analytics subsections
        case 'performance':
          title = 'Performance';
          break;
        case 'leaderboard':
          title = 'Leaderboard';
          break;
        case 'logs':
          title = 'Logs';
          break;
        
        // Simulations subsections
        case 'agents':
          title = 'Agents';
          break;
        case 'scenarios':
          title = 'Scenarios';
          break;
        
        // Management subsections
        case 'staff':
          title = 'Staff';
          break;
        case 'reports':
          title = 'Reports';
          break;
        case 'evals':
          title = 'Evaluations';
          break;
        
        // Common actions
        case 'new':
          title = 'New';
          break;
        case 'edit':
          title = 'Edit';
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

// Helper function to get section from path segments
const getSectionFromSegments = (segments: string[]): string => {
  if (segments.length === 0) return 'dashboard';
  
  const [first, second, third, fourth] = segments;
  
  // Handle main routes (now standalone)
  switch (first) {
    case 'home':
      return 'dashboard'; // Home maps to dashboard section
    
    case 'growth':
      return 'growth';
    
    case 'history':
      return 'history';
    
    case 'rubric':
      return 'rubric';
    
    case 'analytics':
      if (second) {
        return second; // performance, leaderboard, logs
      }
      return 'analytics';
    
    case 'simulations':
      if (second === 'agents') {
        if (third === 'a' && fourth) {
          return `agent-${fourth}`;
        }
        return 'agents';
      }
      if (second === 'scenarios') {
        if (third === 's' && fourth) {
          return `scenario-${fourth}`;
        }
        return 'scenarios';
      }
      if (second === 's' && third) {
        return `simulation-${third}`;
      }
      return 'simulations';
    
    case 'classes':
      if (second === 'c' && third) {
        return `class-${third}`;
      }
      if (second === 'new' && third === 'c' && fourth) {
        return `class-${fourth}`;
      }
      return 'classes';
    
    case 'management':
      if (second) {
        return second; // staff, reports, evals
      }
      return 'staff'; // Default to staff
    
    case 'c':
      if (second) {
        return `chat-${second}`;
      }
      return 'history'; // Chat pages should be under history section
    
    case 'a':
      if (second) {
        return `attempt-${second}`;
      }
      return 'simulations'; // Attempt pages should be under simulations section
    
    case 'profile':
      return 'profile';
    
    default:
      return segments.join('-');
  }
};

// Synchronous version for cases where async isn't possible (fallback)
export const generateBreadcrumbs = (pathname: string): BreadcrumbItem[] => {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    
    // Skip single letter segments
    if (shouldDropSegment(segment)) {
      continue;
    }
    
    // Convert segment to readable title
    let title = segment;
    switch (segment) {
      // Main sections (now standalone)
      case 'home':
        title = 'Home';
        break;
      case 'growth':
        title = 'Growth';
        break;
      case 'history':
        title = 'History';
        break;
      case 'rubric':
        title = 'Rubric';
        break;
      case 'analytics':
        title = 'Analytics';
        break;
      case 'simulations':
        title = 'Simulations';
        break;
      case 'classes':
        title = 'Classes';
        break;
      case 'management':
        title = 'Management';
        break;
      case 'profile':
        title = 'Profile';
        break;
      
      // Subsections
      case 'performance':
        title = 'Performance';
        break;
      case 'leaderboard':
        title = 'Leaderboard';
        break;
      case 'logs':
        title = 'Logs';
        break;
      case 'agents':
        title = 'Agents';
        break;
      case 'scenarios':
        title = 'Scenarios';
        break;
      case 'staff':
        title = 'Staff';
        break;
      case 'reports':
        title = 'Reports';
        break;
      case 'evals':
        title = 'Evaluations';
        break;
      case 'new':
        title = 'New';
        break;
      case 'edit':
        title = 'Edit';
        break;
      
      default:
        // For IDs, try to make them more readable
        if (segment.length > 10) {
          title = `${segment.substring(0, 8)}...`;
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