/**
 * breadcrumb-utils.ts
 * Used to generate breadcrumbs for the app.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */

interface BreadcrumbItem {
  title: string;
  section?: string;
}

// Helper function to determine if a segment should be dropped (single digit or single letter)
const shouldDropSegment = (segment: string): boolean => {
  return /^[a-z]$/.test(segment); // Single letter segments like 'c', 'a', 's', 'u', 'r', 'e'
};

// Helper function to get section from path segments
const getSectionFromSegments = (segments: string[]): string => {
  if (segments.length === 0) return "dashboard";

  const [first, second, third, fourth] = segments;

  // Handle main routes
  switch (first) {
    case "home":
      if (second === "a" && third) {
        return `attempt-${third}`;
      }
      return "home";

    case "practice":
      if (second === "a" && third) {
        return `attempt-${third}`;
      }
      return "practice";

    case "progress":
      return "progress";

    case "rubric":
      return "rubric";

    case "analytics":
      if (second === "pricing") {
        return "pricing";
      }
      if (second === "reports" && third === "p" && fourth) {
        return `profile-${fourth}`;
      }
      if (second) {
        return second; // dashboard, reports, activity, history
      }
      return "analytics";


    case "create":
      if (second === "personas") {
        if (third === "p" && fourth) {
          return `persona-${fourth}`;
        }
        return "personas";
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
      if (second === "videos") {
        return "videos";
      }
      if (second === "cohorts") {
        if (third === "c" && fourth) {
          return `cohort-${fourth}`;
        }
        if (third === "new") {
          return "cohorts";
        }
        return "cohorts";
      }
      return "create";

    case "leaderboard":
      return "leaderboard";

    case "management":
      if (second === "staff") {
        if (third === "p" && fourth) {
          return `profile-${fourth}`;
        }
        return "staff";
      }
      if (second === "documents") {
        if (third === "d" && fourth) {
          return `document-${fourth}`;
        }
        return "documents";
      }
      if (second === "parameters") {
        if (third === "p" && fourth) {
          return `parameter-${fourth}`;
        }
        return "parameters";
      }
      if (second === "fields") {
        return "fields";
      }
      if (second) {
        return second;
      }
      return "management";

    case "engine":
      if (second === "agents") {
        if (third === "a" && fourth) {
          return `agent-${fourth}`;
        }
        return "agents";
      }
      if (second === "models") {
        if (third) {
          return `model-${third}`;
        }
        return "models";
      }
      if (second === "rubrics") {
        if (third === "r" && fourth) {
          return `rubric-${fourth}`;
        }
        return "rubrics";
      }
      if (second === "evals") {
        return "evals";
      }
      return "engine";

    case "system":
      if (second === "providers") {
        return "providers";
      }
      if (second === "auth") {
        return "auth";
      }
      if (second === "health") {
        return "health";
      }
      if (second === "departments") {
        if (third === "d" && fourth) {
          return `department-${fourth}`;
        }
        return "departments";
      }
      return "system";

    case "settings":
      return "settings";

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
      case "practice":
        title = "Practice";
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
      case "leaderboard":
        title = "Leaderboard";
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
      case "departments":
        title = "Departments";
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
      case "models":
        title = "Models";
        break;
      case "parameters":
        title = "Parameters";
        break;
      case "videos":
        title = "Videos";
        break;
      case "cohorts":
        title = "Cohorts";
        break;
      case "auth":
        title = "Auth";
        break;
      case "documents":
        title = "Documents";
        break;
      case "health":
        title = "Health";
        break;
      case "settings":
        title = "Settings";
        break;
      case "providers":
        title = "Providers";
        break;
      case "evals":
        title = "Evals";
        break;
      case "engine":
        title = "Engine";
        break;
      case "fields":
        title = "Fields";
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
