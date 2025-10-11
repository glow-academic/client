import { handle } from "@/lib/api/route-factory";
import { simulationScenarioRepo } from "@/lib/repos/simulationScenarioRepo";
import { z } from "zod";
import { log } from "@/utils/logger";

const Body = z.object({ ids: z.array(z.string()).min(1) });

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  return handle(
    () => simulationScenarioRepo.listByScenarios(parsed.data.ids),
    (e: unknown) =>
      log.error("api.simulation_scenarios.by.scenarioId.batch.failed", {
        message: "Failed to fetch by foreign key batch",
        subject: { entityType: "simulation_scenarios" },
        context: { foreignKey: "scenarioId", count: parsed.data.ids.length },
        error: e,
      })
  );
}
