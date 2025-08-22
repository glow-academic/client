import { handle } from "@/lib/api/route-factory";
import { simulationChatRepo } from "@/lib/repos/simulationChatRepo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => simulationChatRepo.listByScenario(id),
    (e: unknown) =>
      log.error("api.simulation_chats.by.scenarioId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "simulation_chats" },
        context: { foreignKey: "scenarioId", id },
        error: e,
      })
  );
}
