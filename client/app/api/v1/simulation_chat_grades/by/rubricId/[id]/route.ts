import { handle } from "@/lib/api/route-factory";
import { simulationChatGradeRepo } from "@/lib/repos/simulationChatGradeRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => simulationChatGradeRepo.listByRubric(id),
    (e: unknown) =>
      log.error("api.simulation_chat_grades.by.rubricId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "simulation_chat_grades" },
        context: { foreignKey: "rubricId", id },
        error: e,
      }),
  );
}
