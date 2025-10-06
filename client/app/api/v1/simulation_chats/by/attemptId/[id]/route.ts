import { handle } from "@/lib/api/route-factory";
import { simulationChatRepo } from "@/lib/repos/simulationChatRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => simulationChatRepo.listBySimulationAttempt(id),
    (e: unknown) =>
      log.error("api.simulation_chats.by.attemptId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "simulation_chats" },
        context: { foreignKey: "attemptId", id },
        error: e,
      }),
  );
}
