import { useResolveBreadcrumb } from "@/lib/api/hooks/breadcrumbs";
import { useEffect, useState } from "react";

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
      return "home";

    case "practice":
      if (second === "a" && third) {
        return "practice";
      }
      return "practice";

    case "progress":
      return "progress";

    case "rubric":
      return "rubric";

    case "analytics":
      if (second) {
        return second; // dashboard, reports, history
      }
      return "analytics";

    case "cohorts":
      if (second === "c" && third) {
        return `cohort-${third}`;
      }
      if (second === "e" && third) {
        return `cohort-${third}`;
      }
      return "cohorts";

    case "create":
      if (second === "personas") {
        if (third === "a" && fourth) {
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
      if (second === "rubrics") {
        if (third === "r" && fourth) {
          return `rubric-${fourth}`;
        }
        return "rubrics";
      }
      if (second === "documents") {
        if (third === "d" && fourth) {
          return `document-${fourth}`;
        }
        return "documents";
      }
      return "create";

    case "management":
      if (second === "staff") {
        if (third === "p" && fourth) {
          return `profile-${fourth}`;
        }
        return "staff";
      }
      if (second === "providers") {
        if (third === "p" && fourth) {
          return `provider-${fourth}`;
        }
        return "providers";
      }
      if (second === "pricing") {
        return "pricing";
      }
      if (second === "parameters") {
        if (third === "p" && fourth) {
          return `parameter-${fourth}`;
        }
        return "parameters";
      }
      if (second) {
        return second; // staff, context, logs, models, rubrics
      }
      return "management";

    case "system":
      if (second === "agents") {
        if (third === "a" && fourth) {
          return `agent-${fourth}`;
        }
        return "agents";
      }
      if (second === "feedback") {
        return "feedback";
      }
      if (second === "logs") {
        return "logs";
      }
      if (second === "health") {
        return "health";
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

// Hook for generating breadcrumbs with async ID resolution
export function useBreadcrumbs(pathname: string) {
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const resolveBreadcrumb = useResolveBreadcrumb();

  useEffect(() => {
    const generateBreadcrumbs = async () => {
      setIsLoading(true);
      const segments = pathname.split("/").filter(Boolean);
      const newBreadcrumbs: BreadcrumbItem[] = [];

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
          } else if (prevSegment === "e" && segments.includes("cohorts")) {
            context = "cohort";
          } else if (prevSegment === "m" && segments.includes("providers")) {
            context = "model";
          } else if (prevSegment === "a" && segments.includes("home")) {
            context = "attempt";
          } else if (prevSegment === "a" && segments.includes("practice")) {
            context = "attempt";
          } else if (prevSegment === "s" && segments.includes("simulations")) {
            context = "simulation";
          } else if (prevSegment === "p" && segments.includes("personas")) {
            context = "persona";
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
          } else if (prevSegment === "p" && segments.includes("parameters")) {
            context = "parameter";
          }

          if (context) {
            try {
              const resolvedName = await resolveBreadcrumb.mutateAsync({
                id: segment || "",
                context,
              });
              title = resolvedName;
            } catch {
              // Fallback to generic names for known contexts
              switch (context) {
                case "provider":
                  title = "Provider";
                  break;
                case "model":
                  title = "Model";
                  break;
                case "persona":
                  title = "Persona";
                  break;
                case "agent":
                  title = "Agent";
                  break;
                case "scenario":
                  title = "Scenario";
                  break;
                case "simulation":
                  title = "Simulation";
                  break;
                case "chat":
                  title = "Chat";
                  break;
                case "profile":
                  title = "Profile";
                  break;
                case "rubric":
                  title = "Rubric";
                  break;
                case "cohort":
                  title = "Cohort";
                  break;
                case "attempt":
                  title = "Attempt";
                  break;
                case "report":
                  title = "Report";
                  break;
                case "parameter":
                  title = "Parameter";
                  break;
                default:
                  title =
                    segment && segment.length > 10
                      ? `${segment.substring(0, 8)}...`
                      : segment || "";
              }
            }
          }
        } else {
          // Convert segment to readable title for non-IDs
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

            // Create subsections
            case "personas":
              title = "Personas";
              break;
            case "scenarios":
              title = "Scenarios";
              break;
            case "rubrics":
              title = "Rubrics";
              break;
            case "documents":
              title = "Documents";
              break;

            // Management subsections
            case "staff":
              title = "Staff";
              break;
            case "context":
              title = "Context";
              break;
            case "providers":
              title = "Providers";
              break;
            case "pricing":
              title = "Pricing";
              break;
            case "parameters":
              title = "Parameters";
              break;
            case "models":
              title = "Models";
              break;

            // System subsections
            case "agents":
              title = "Agents";
              break;
            case "feedback":
              title = "Feedback";
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

        newBreadcrumbs.push({
          title: title || "",
          section: getSectionFromSegments(segments.slice(0, i + 1)),
        });
      }

      setBreadcrumbs(newBreadcrumbs);
      setIsLoading(false);
    };

    generateBreadcrumbs();
  }, [pathname, resolveBreadcrumb]);

  return { breadcrumbs, isLoading };
}

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
      case "providers":
        title = "Providers";
        break;
      case "parameters":
        title = "Parameters";
        break;
      case "documents":
        title = "Documents";
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
