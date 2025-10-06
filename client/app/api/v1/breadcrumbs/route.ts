import { handle } from "@/lib/api/route-factory";
import { agentRepo } from "@/lib/repos/agentRepo";
import { cohortRepo } from "@/lib/repos/cohortRepo";
import { modelRepo } from "@/lib/repos/modelRepo";
import { parameterRepo } from "@/lib/repos/parameterRepo";
import { personaRepo } from "@/lib/repos/personaRepo";
import { profileRepo } from "@/lib/repos/profileRepo";
import { providerRepo } from "@/lib/repos/providerRepo";
import { rubricRepo } from "@/lib/repos/rubricRepo";
import { scenarioRepo } from "@/lib/repos/scenarioRepo";
import { simulationAttemptRepo } from "@/lib/repos/simulationAttemptRepo";
import { simulationChatRepo } from "@/lib/repos/simulationChatRepo";
import { simulationRepo } from "@/lib/repos/simulationRepo";
import { log } from "@/utils/logger";

interface ResolveBreadcrumbRequest {
  id: string;
  context: string;
}

interface ResolveBreadcrumbResponse {
  name: string;
}

// Helper function to fetch actual name for an ID based on context
const fetchNameForId = async (id: string, context: string): Promise<string> => {
  try {
    switch (context) {
      case "attempt":
        const attemptData = await simulationAttemptRepo.find(id);
        if (!attemptData) {
          return `Attempt ${id.substring(0, 8)}...`;
        }
        // get simulation for attempt
        const attemptSimulation = await simulationRepo.find(
          attemptData?.simulationId,
        );
        // Attempts don't have a title, so we'll use a generic name with timestamp
        return attemptSimulation?.title || `Attempt ${id.substring(0, 8)}...`;

      case "scenario":
        const scenarioData = await scenarioRepo.find(id);
        return scenarioData?.name || `Scenario ${id.substring(0, 8)}...`;

      case "persona":
        const personaData = await personaRepo.find(id);
        return personaData?.name || `Persona ${id.substring(0, 8)}...`;
      case "agent":
        const agentData = await agentRepo.find(id);
        return agentData?.name || `Agent ${id.substring(0, 8)}...`;
      case "simulation":
        const simulationData = await simulationRepo.find(id);
        return simulationData?.title || `Simulation ${id.substring(0, 8)}...`;

      case "chat":
        const chatData = await simulationChatRepo.find(id);
        return chatData?.title || `Chat ${id.substring(0, 8)}...`;

      case "profile":
        const profileData = await profileRepo.find(id);
        return (
          profileData?.firstName + " " + profileData?.lastName ||
          `Profile ${id.substring(0, 8)}...`
        );

      case "rubric":
        const rubricData = await rubricRepo.find(id);
        return rubricData?.name || `Rubric ${id.substring(0, 8)}...`;

      case "cohort":
        const cohortData = await cohortRepo.find(id);
        return cohortData?.title || `Cohort ${id.substring(0, 8)}...`;

      case "model":
        const modelData = await modelRepo.find(id);
        return modelData?.name || `Model ${id.substring(0, 8)}...`;

      case "report":
        const reportProfileData = await profileRepo.find(id);
        return (
          reportProfileData?.firstName + " " + reportProfileData?.lastName ||
          `Profile ${id.substring(0, 8)}...`
        );

      case "provider":
        const providerData = await providerRepo.find(id);
        if (providerData?.name) {
          return providerData.name;
        }
        // Better fallback that includes the ID for debugging
        return `Provider ${id.substring(0, 8)}...`;

      case "parameter":
        const parameterData = await parameterRepo.find(id);
        return parameterData?.name || `Parameter ${id.substring(0, 8)}...`;

      default:
        return id.length > 10 ? `${id.substring(0, 8)}...` : id;
    }
  } catch (error) {
    log.error("api.breadcrumbs.fetch_name.failed", {
      message: `Error fetching name for ${context} ID ${id}`,
      error,
      context: { function: "fetchNameForId", contextType: context, id },
    });
    // Fallback to generic titles for known contexts to avoid exposing raw IDs
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
};

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  const { id, context }: ResolveBreadcrumbRequest = body;

  if (!id || !context) {
    return Response.json(
      { error: "Missing required fields: id and context" },
      { status: 400 },
    );
  }

  return handle(
    async () => {
      const name = await fetchNameForId(id, context);
      return { name } as ResolveBreadcrumbResponse;
    },
    (e: unknown) =>
      log.error("api.breadcrumbs.failed", {
        message: "Failed to resolve breadcrumb",
        subject: { entityType: "breadcrumb", entityId: id },
        context: { id, context },
        error: e,
      }),
  );
}
