import { handle } from "@/lib/api/route-factory";
import { simulationChatCrowdsourcedFeedbackRepo } from "@/lib/repos/simulationChatCrowdsourcedFeedbackRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => simulationChatCrowdsourcedFeedbackRepo.listByProfile(id),
    (e: unknown) =>
      log.error(
        "api.simulation_chat_crowdsourced_feedbacks.by.profileId.get.failed",
        {
          message: "Failed to fetch by foreign key",
          subject: { entityType: "simulation_chat_crowdsourced_feedbacks" },
          context: { foreignKey: "profileId", id },
          error: e,
        },
      ),
  );
}
