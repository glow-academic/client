import { handle } from "@/lib/api/route-factory";
import { scenarioObjectiveRepo } from "@/lib/repos/scenarioObjectiveRepo";
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
    () => scenarioObjectiveRepo.listByScenarios(parsed.data.ids),
    (e: unknown) =>
      log.error("api.scenario_objectives.by.scenarioId.batch.failed", {
        message: "Failed to fetch by foreign key batch",
        subject: { entityType: "scenario_objectives" },
        context: { foreignKey: "scenarioId", count: parsed.data.ids.length },
        error: e,
      }),
  );
}
