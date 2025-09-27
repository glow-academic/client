import { log } from "@/utils/logger";

interface ResolveBreadcrumbRequest {
  id: string;
  context: string;
}

interface ResolveBreadcrumbResponse {
  name: string;
}

export async function resolveBreadcrumb(
  id: string,
  context: string
): Promise<string> {
  try {
    log.info("api.breadcrumbs.resolve.request", {
      message: "Resolving breadcrumb name",
      context: { id, context },
    });

    const response = await fetch("/api/v1/breadcrumbs/resolve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id, context } as ResolveBreadcrumbRequest),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = (await response.json()) as ResolveBreadcrumbResponse;

    log.info("api.breadcrumbs.resolve.success", {
      message: "Successfully resolved breadcrumb name",
      context: { id, context, resolvedName: data.name },
    });

    return data.name;
  } catch (error) {
    log.error("api.breadcrumbs.resolve.failed", {
      message: "Failed to resolve breadcrumb name",
      context: { id, context },
      error,
    });

    // Fallback to generic names for known contexts
    switch (context) {
      case "provider":
        return "Provider";
      case "model":
        return "Model";
      case "persona":
        return "Persona";
      case "agent":
        return "Agent";
      case "scenario":
        return "Scenario";
      case "simulation":
        return "Simulation";
      case "chat":
        return "Chat";
      case "profile":
        return "Profile";
      case "rubric":
        return "Rubric";
      case "cohort":
        return "Cohort";
      case "attempt":
        return "Attempt";
      case "report":
        return "Report";
      case "parameter":
        return "Parameter";
      default:
        return id.length > 10 ? `${id.substring(0, 8)}...` : id;
    }
  }
}
