import { handle } from "@/lib/api/route-factory";
import { simulationScenarioRepo } from "@/lib/repos/simulationScenarioRepo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => simulationScenarioRepo.listByScenario(id),
    (e: unknown) =>
      log.error("api.simulation_scenarios.by.scenarioId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "simulation_scenarios" },
        context: { foreignKey: "scenarioId", id },
        error: e,
      })
  );
}
