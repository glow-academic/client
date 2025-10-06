import { handle } from "@/lib/api/route-factory";
import { simulationChatFeedbackRepo } from "@/lib/repos/simulationChatFeedbackRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => simulationChatFeedbackRepo.listBySimulationChatGrade(id),
    (e: unknown) =>
      log.error(
        "api.simulation_chat_feedbacks.by.simulationChatGradeId.get.failed",
        {
          message: "Failed to fetch by foreign key",
          subject: { entityType: "simulation_chat_feedbacks" },
          context: { foreignKey: "simulationChatGradeId", id },
          error: e,
        },
      ),
  );
}
