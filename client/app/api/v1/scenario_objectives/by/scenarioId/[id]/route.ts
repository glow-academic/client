import { handle } from "@/lib/api/route-factory";
import { scenarioObjectiveRepo } from "@/lib/repos/scenarioObjectiveRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => scenarioObjectiveRepo.listByScenario(id),
    (e: unknown) =>
      log.error("api.scenario_objectives.by.scenarioId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "scenario_objectives" },
        context: { foreignKey: "scenarioId", id },
        error: e,
      }),
  );
}
