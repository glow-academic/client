import { handle } from "@/lib/api/route-factory";
import { simulationCrowdsourcedMessageRepo } from "@/lib/repos/simulationCrowdsourcedMessageRepo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => simulationCrowdsourcedMessageRepo.listBySimulationMessage(id),
    (e: unknown) =>
      log.error("api.simulation_crowdsourced_messages.by.simulationMessageId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "simulation_crowdsourced_messages" },
        context: { foreignKey: "simulationMessageId", id },
        error: e,
      })
  );
}
