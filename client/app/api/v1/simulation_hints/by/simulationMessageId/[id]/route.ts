import { handle } from "@/lib/api/route-factory";
import { simulationHintRepo } from "@/lib/repos/simulationHintRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => simulationHintRepo.listBySimulationMessage(id),
    (e: unknown) =>
      log.error("api.simulation_hints.by.simulationMessageId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "simulation_hints" },
        context: { foreignKey: "simulationMessageId", id },
        error: e,
      }),
  );
}
