import { handle } from "@/lib/api/route-factory";
import { scenarioPersonaRepo } from "@/lib/repos/scenarioPersonaRepo";
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
    () => scenarioPersonaRepo.listByScenarios(parsed.data.ids),
    (e: unknown) =>
      log.error("api.scenario_personas.by.scenarioId.batch.failed", {
        message: "Failed to fetch by foreign key batch",
        subject: { entityType: "scenario_personas" },
        context: { foreignKey: "scenarioId", count: parsed.data.ids.length },
        error: e,
      }),
  );
}
