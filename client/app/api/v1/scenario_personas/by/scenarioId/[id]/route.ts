import { handle } from "@/lib/api/route-factory";
import { scenarioPersonaRepo } from "@/lib/repos/scenarioPersonaRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => scenarioPersonaRepo.listByScenario(id),
    (e: unknown) =>
      log.error("api.scenario_personas.by.scenarioId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "scenario_personas" },
        context: { foreignKey: "scenarioId", id },
        error: e,
      }),
  );
}
