/**
 * breadcrumb-utils.ts
 * Used to generate breadcrumbs for the app.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import { logError } from "@/utils/logger";
import { getAgent } from "@/utils/queries/agents/get-agent";
import { getScenario } from "@/utils/queries/scenarios/get-scenario";
import { getSimulation } from "@/utils/queries/simulations/get-simulation";
import { getCohort } from "./queries/cohorts/get-cohort";
import { getModel } from "./queries/models/get-model";
import { getProfile } from "./queries/profiles/get-profile";
import { getRubric } from "./queries/rubrics/get-rubric";
import { getSimulationAttempt } from "./queries/simulation_attempts/get-simulation-attempt";
import { getSimulationChat } from "./queries/simulation_chats/get-simulation-chat";
import { getSystemAgent } from "./queries/system_agents/get-system-agent";

interface BreadcrumbItem {
  title: string;
  section?: string;
}

// Helper function to determine if a segment should be dropped (single digit or single letter)
const shouldDropSegment = (segment: string): boolean => {
  return /^[a-z]$/.test(segment); // Single letter segments like 'c', 'a', 's', 'u', 'r', 'e'
};

// Helper function to fetch actual name for an ID based on context
const fetchNameForId = async (id: string, context: string): Promise<string> => {
  try {
    switch (context) {
      case "attempt":
        const attemptData = await getSimulationAttempt(id);
        if (!attemptData) {
          return `Attempt ${id.substring(0, 8)}...`;
        }
        // get simulation for attempt
        const attemptSimulation = await getSimulation(
          attemptData?.simulationId
        );
        // Attempts don't have a title, so we'll use a generic name with timestamp
        return attemptSimulation?.title || `Attempt ${id.substring(0, 8)}...`;

      case "scenario":
        const scenarioData = await getScenario(id);
        return scenarioData?.name || `Scenario ${id.substring(0, 8)}...`;

      case "agent":
        const agentData = await getAgent(id);
        return agentData?.name || `Agent ${id.substring(0, 8)}...`;
      case "system-agent":
        const systemAgentData = await getSystemAgent(id);
        return systemAgentData?.name || `System Agent ${id.substring(0, 8)}...`;

      case "simulation":
        const simulationData = await getSimulation(id);
        return simulationData?.title || `Simulation ${id.substring(0, 8)}...`;

      case "chat":
        const chatData = await getSimulationChat(id);
        return chatData?.title || `Chat ${id.substring(0, 8)}...`;

      case "profile":
        const profileData = await getProfile(id);
        return (
          profileData?.firstName + " " + profileData?.lastName ||
          `Profile ${id.substring(0, 8)}...`
        );

      case "rubric":
        const rubricData = await getRubric(id);
        return rubricData?.name || `Rubric ${id.substring(0, 8)}...`;

      case "cohort":
        const cohortData = await getCohort(id);
        return cohortData?.title || `Cohort ${id.substring(0, 8)}...`;

      case "model":
        const modelData = await getModel(id);
        return modelData?.name || `Model ${id.substring(0, 8)}...`;

      case "report":
        const reportProfileData = await getProfile(id);
        return (
          reportProfileData?.firstName + " " + reportProfileData?.lastName ||
          `Profile ${id.substring(0, 8)}...`
        );

      case "provider":
        // For now, return a generic provider name since we don't have a getProvider function
        return `Provider ${id.substring(0, 8)}...`;

      default:
        return id.length > 10 ? `${id.substring(0, 8)}...` : id;
    }
  } catch (error) {
    logError(`Error fetching name for ${context} ID ${id}:`, error);
    return id.length > 10 ? `${id.substring(0, 8)}...` : id;
  }
};

// Enhanced breadcrumb generation with async ID resolution
export const generateEnhancedBreadcrumbs = async (
  pathname: string
): Promise<BreadcrumbItem[]> => {
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const prevSegment = i > 0 ? segments[i - 1] : "";

    // Skip single letter segments that are just route markers
    if (shouldDropSegment(segment || "")) {
      continue;
    }

    // Determine context for ID resolution
    let context = "";
    let title = segment;

    // Check if this is an ID that needs resolution
    // IDs are typically UUIDs or hex strings with dashes, not regular words
    const isLikelyId =
      /^[a-f0-9-]{8,}/.test(segment || "") ||
      (segment?.length &&
        segment?.length > 15 &&
        /^[a-zA-Z0-9-]+$/.test(segment || "") &&
        segment?.includes("-"));

    if (isLikelyId) {
      // Determine context based on route structure
      if (prevSegment === "c" && segments.includes("classes")) {
        context = "class";
      } else if (prevSegment === "c" && segments[0] === "c") {
        context = "chat";
      } else if (prevSegment === "c" && segments.includes("cohorts")) {
        context = "cohort";
      } else if (prevSegment === "m" && segments.includes("models")) {
        context = "model";
      } else if (prevSegment === "a" && segments.includes("home")) {
        context = "attempt";
      } else if (prevSegment === "s" && segments.includes("simulations")) {
        context = "simulation";
      } else if (prevSegment === "a" && segments.includes("agents")) {
        context = "agent";
      } else if (prevSegment === "s" && segments.includes("scenarios")) {
        context = "scenario";
      } else if (prevSegment === "p" && segments.includes("staff")) {
        context = "profile";
      } else if (prevSegment === "p" && segments.includes("providers")) {
        context = "provider";
      } else if (prevSegment === "r" && segments.includes("rubrics")) {
        context = "rubric";
      } else if (prevSegment === "p" && segments.includes("reports")) {
        context = "report";
      }

      if (context) {
        title = await fetchNameForId(segment || "", context);
      }
    } else {
      // Convert segment to readable title for non-IDs
      switch (segment) {
        // Main sections
        case "home":
          title = "Home";
          break;
        case "progress":
          title = "Progress";
          break;
        case "rubric":
          title = "Rubric";
          break;
        case "analytics":
          title = "Analytics";
          break;
        case "simulations":
          title = "Simulations";
          break;
        case "management":
          title = "Management";
          break;
        case "system":
          title = "System";
          break;
        case "profile":
          title = "Profile";
          break;
        case "create":
          title = "Create";
          break;

        // Analytics subsections
        case "overview":
          title = "Overview";
          break;
        case "performance":
          title = "Performance";
          break;
        case "reports":
          title = "Reports";
          break;
        case "progress":
          title = "Progress";
          break;

        // Create subsections
        case "agents":
          title = "Agents";
          break;
        case "scenarios":
          title = "Scenarios";
          break;
        case "rubrics":
          title = "Rubrics";
          break;
        case "simulations":
          title = "Simulations";
          break;

        // Management subsections
        case "staff":
          title = "Staff";
          break;
        case "cohorts":
          title = "Cohorts";
          break;
        case "logs":
          title = "Logs";
          break;
        case "models":
          title = "Models";
          break;

        // System subsections
        case "agents":
          title = "Agents";
          break;
        case "providers":
          title = "Providers";
          break;
        case "health":
          title = "Health";
          break;
        // Common actions
        case "new":
          title = "New";
          break;
        case "edit":
          title = "Edit";
          break;

        default:
          if (segment) {
            title = segment.charAt(0).toUpperCase() + segment.slice(1);
          }
      }
    }

    breadcrumbs.push({
      title: title || "",
      section: getSectionFromSegments(segments.slice(0, i + 1)),
    });
  }

  return breadcrumbs;
};

// Helper function to get section from path segments
const getSectionFromSegments = (segments: string[]): string => {
  if (segments.length === 0) return "dashboard";

  const [first, second, third, fourth] = segments;

  // Handle main routes
  switch (first) {
    case "home":
      return "home";

    case "progress":
      return "progress";

    case "rubric":
      return "rubric";

    case "analytics":
      if (second) {
        return second; // dashboard, reports, history
      }
      return "analytics";

    case "create":
      if (second === "agents") {
        if (third === "a" && fourth) {
          return `agent-${fourth}`;
        }
        return "agents";
      }
      if (second === "scenarios") {
        if (third === "s" && fourth) {
          return `scenario-${fourth}`;
        }
        return "scenarios";
      }
      if (second === "simulations") {
        if (third === "s" && fourth) {
          return `simulation-${fourth}`;
        }
        return "simulations";
      }
      if (second === "rubrics") {
        if (third === "r" && fourth) {
          return `rubric-${fourth}`;
        }
        return "rubrics";
      }
      return "create";

    case "management":
      if (second === "staff") {
        if (third === "p" && fourth) {
          return `profile-${fourth}`;
        }
        return "staff";
      }
      if (second) {
        return second; // staff, agents, logs, models, rubrics
      }
      return "management";

    case "system":
      if (second === "agents") {
        if (third === "a" && fourth) {
          return `system-agent-${fourth}`;
        }
        return "system-agents";
      }
      if (second === "providers") {
        if (third === "p" && fourth) {
          return `provider-${fourth}`;
        }
        return "system-providers";
      }
      if (second === "logs") {
        return "system-logs";
      }
      if (second === "health") {
        return "system-health";
      }
      return "system";

    case "c":
      if (second) {
        return `chat-${second}`;
      }
      return "progress"; // Chat pages should be under progress section

    case "a":
      if (second) {
        return `attempt-${second}`;
      }
      return "simulations"; // Attempt pages should be under simulations section

    case "profile":
      return "profile";

    default:
      return segments.join("-");
  }
};

// Synchronous version for cases where async isn't possible (fallback)
export const generateBreadcrumbs = (pathname: string): BreadcrumbItem[] => {
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];

    // Skip single letter segments
    if (shouldDropSegment(segment || "")) {
      continue;
    }

    // Convert segment to readable title
    let title = segment;
    switch (segment) {
      // Main sections
      case "home":
        title = "Home";
        break;
      case "progress":
        title = "Progress";
        break;
      case "rubric":
        title = "Rubric";
        break;
      case "analytics":
        title = "Analytics";
        break;
      case "simulations":
        title = "Simulations";
        break;
      case "management":
        title = "Management";
        break;
      case "system":
        title = "System";
        break;
      case "profile":
        title = "Profile";
        break;
      case "create":
        title = "Create";
        break;

      // Subsections
      case "overview":
        title = "Overview";
        break;
      case "performance":
        title = "Performance";
        break;
      case "reports":
        title = "Reports";
        break;
      case "progress":
        title = "Progress";
        break;
      case "agents":
        title = "Agents";
        break;
      case "scenarios":
        title = "Scenarios";
        break;
      case "rubrics":
        title = "Rubrics";
        break;
      case "staff":
        title = "Staff";
        break;
      case "agents":
        title = "Agents";
        break;
      case "providers":
        title = "Providers";
        break;
      case "logs":
        title = "Logs";
        break;
      case "health":
        title = "Health";
        break;
      case "new":
        title = "New";
        break;
      case "edit":
        title = "Edit";
        break;

      default:
        // For IDs, try to make them more readable
        // Only truncate if it looks like an ID (contains dashes and is long)
        if (
          segment &&
          segment.length &&
          segment.length > 15 &&
          segment.includes("-")
        ) {
          title = `${segment.substring(0, 8)}...`;
        } else if (segment) {
          title = segment.charAt(0).toUpperCase() + segment.slice(1);
        }
    }

    breadcrumbs.push({
      title: title || "",
      section: getSectionFromSegments(segments.slice(0, i + 1)),
    });
  }

  return breadcrumbs;
};

// Helper function to get active section from pathname
export const getActiveSectionFromPath = (pathname: string) => {
  const segments = pathname.split("/").filter(Boolean);
  return getSectionFromSegments(segments);
};
