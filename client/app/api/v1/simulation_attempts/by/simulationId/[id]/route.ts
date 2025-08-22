import { handle } from "@/lib/api/route-factory";
import { simulationAttemptRepo } from "@/lib/repos/simulationAttemptRepo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => simulationAttemptRepo.listBySimulation(id),
    (e: unknown) =>
      log.error("api.simulation_attempts.by.simulationId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "simulation_attempts" },
        context: { foreignKey: "simulationId", id },
        error: e,
      })
  );
}
