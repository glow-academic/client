import { api } from "@/lib/api/fetcher";
import { log } from "@/utils/logger";
import { useMutation } from "@tanstack/react-query";

interface ResolveBreadcrumbRequest {
  id: string;
  context: string;
}

interface ResolveBreadcrumbResponse {
  name: string;
}

// Hook for resolving breadcrumb names from IDs
export function useResolveBreadcrumb() {
  return useMutation({
    mutationFn: async ({
      id,
      context,
    }: ResolveBreadcrumbRequest): Promise<string> => {
      try {
        log.info("api.breadcrumbs.resolve.request", {
          message: "Resolving breadcrumb name",
          context: { id, context },
        });

        const response = await api<ResolveBreadcrumbResponse>(
          "/api/v1/breadcrumbs",
          {
            method: "POST",
            body: JSON.stringify({ id, context }),
          }
        );

        log.info("api.breadcrumbs.resolve.success", {
          message: "Successfully resolved breadcrumb name",
          context: { id, context, resolvedName: response.name },
        });

        return response.name;
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
    },
  });
}
