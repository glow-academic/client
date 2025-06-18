/**
 * breadcrumb-utils.ts
 * Used to generate breadcrumbs for the app.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import { getAgent } from "@/utils/queries/agents/get-agent";
import { getClass } from "@/utils/queries/classes/get-class";
import { getScenario } from "@/utils/queries/scenarios/get-scenario";
import { getSimulation } from "@/utils/queries/simulations/get-simulation";
import { getEvalRun } from "./queries/eval_runs/get-eval-run";
import { getEval } from "./queries/evals/get-eval";
import { getProfile } from "./queries/profiles/get-profile";
import { getRubric } from "./queries/rubrics/get-rubric";
import { getSimulationAttempt } from "./queries/simulation_attempts/get-simulation-attempt";
import { getSimulationChat } from "./queries/simulation_chats/get-simulation-chat";
import { logError } from "@/utils/logger";

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
      case "class":
        const classData = await getClass(id);
        return classData?.classCode || `Class ${id.substring(0, 8)}...`;

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

      case "eval":
        const evalData = await getEval(id);
        return evalData?.name || `Evaluation ${id.substring(0, 8)}...`;

      case "eval-run":
        const evalRunData = await getEvalRun(id);
        // get the agent for the eval run
        if (!evalRunData) {
          return `Eval Run ${id.substring(0, 8)}...`;
        }
        const agentEvalData = await getAgent(evalRunData?.agentId);
        // get base agent from eval
        const evalRunEvalData = await getEval(evalRunData?.evalId || "");
        const baseAgent = await getAgent(evalRunEvalData?.baseAgentId || "");
        return `${baseAgent?.name} vs ${agentEvalData?.name}`;

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
      } else if (prevSegment === "r" && segments.includes("rubrics")) {
        context = "rubric";
      } else if (prevSegment === "r" && segments.includes("evals")) {
        context = "eval-run";
      } else if (prevSegment === "e" && segments.includes("evals")) {
        context = "eval";
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
        case "growth":
          title = "Growth";
          break;
        case "history":
          title = "History";
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
        case "classes":
          title = "Classes";
          break;
        case "cohorts":
          title = "Cohorts";
          break;
        case "models":
          title = "Models";
          break;
        case "logs":
          title = "Logs";
          break;
        case "management":
          title = "Management";
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
        case "history":
          title = "History";
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

        // Management subsections
        case "staff":
          title = "Staff";
          break;
        case "evals":
          title = "Evaluations";
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

  const [first, second, third, fourth, fifth] = segments;

  // Handle main routes
  switch (first) {
    case "home":
      return "home";

    case "growth":
      return "growth";

    case "history":
      return "history";

    case "rubric":
      return "rubric";

    case "analytics":
      if (second) {
        return second; // overview, performance, reports, logs
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

    case "classes":
      if (second === "c" && third) {
        return `class-${third}`;
      }
      return "classes";

    case "management":
      if (second === "staff") {
        if (third === "p" && fourth) {
          return `profile-${fourth}`;
        }
        return "staff";
      }
      if (second === "classes") {
        if (third === "new" && fourth === "c" && fifth) {
          return `class-${fifth}`;
        }
        return "classes";
      }
      if (second === "agents") {
        if (third === "a" && fourth) {
          return `agent-${fourth}`;
        }
        return "agents";
      }
      if (second === "evals") {
        if (third === "e" && fourth) {
          return `eval-${fourth}`;
        }
        return "evals";
      }
      if (second === "cohorts") {
        if (third === "c" && fourth) {
          return `cohort-${fourth}`;
        }
        return "cohorts";
      }
      if (second === "models") {
        if (third === "m" && fourth) {
          return `model-${fourth}`;
        }
        return "models";
      }
      if (second) {
        return second; // staff, classes, agents, evals
      }
      return "management";

    case "c":
      if (second) {
        return `chat-${second}`;
      }
      return "history"; // Chat pages should be under history section

    case "a":
      if (second) {
        return `attempt-${second}`;
      }
      return "simulations"; // Attempt pages should be under simulations section

    case "e":
      if (second) {
        return `eval-${second}`;
      }
      return "evals"; // Evaluation pages

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
      case "growth":
        title = "Growth";
        break;
      case "history":
        title = "History";
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
      case "classes":
        title = "Classes";
        break;
      case "management":
        title = "Management";
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
      case "history":
        title = "History";
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
      case "evals":
        title = "Evaluations";
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
