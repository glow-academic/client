import { handle } from "@/lib/api/route-factory";
import { simulationChatGradeRepo } from "@/lib/repos/simulationChatGradeRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => simulationChatGradeRepo.listBySimulationChat(id),
    (e: unknown) =>
      log.error("api.simulation_chat_grades.by.simulationChatId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "simulation_chat_grades" },
        context: { foreignKey: "simulationChatId", id },
        error: e,
      }),
  );
}
