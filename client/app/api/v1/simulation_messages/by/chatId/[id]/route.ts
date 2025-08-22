import { handle } from "@/lib/api/route-factory";
import { simulationMessageRepo } from "@/lib/repos/simulationMessageRepo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => simulationMessageRepo.listBySimulationChat(id),
    (e: unknown) =>
      log.error("api.simulation_messages.by.chatId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "simulation_messages" },
        context: { foreignKey: "chatId", id },
        error: e,
      })
  );
}
