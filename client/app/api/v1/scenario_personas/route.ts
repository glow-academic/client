import { handle } from "@/lib/api/route-factory";
import { scenarioPersonaRepo, ScenarioPersonaCreateSchema } from "@/lib/repos/scenarioPersonaRepo";
import type { ScenarioPersonaCreate } from "@/lib/repos/scenarioPersonaRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => scenarioPersonaRepo.list(),
    (e: unknown) =>
      log.error("api.scenario_personas.list.failed", {
        message: "Failed to list scenario_personas",
        subject: { entityType: "scenario_personas" },
        error: e,
      })
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = ScenarioPersonaCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as ScenarioPersonaCreate;
  return handle(
    () => scenarioPersonaRepo.create(payload),
    (e: unknown) =>
      log.error("api.scenario_personas.create.failed", {
        message: "Failed to create scenarioPersona",
        subject: { entityType: "scenario_personas" },
        context: { body: json },
        error: e,
      })
  );
}
