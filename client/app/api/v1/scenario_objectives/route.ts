import { handle } from "@/lib/api/route-factory";
import {
  scenarioObjectiveRepo,
  ScenarioObjectiveCreateSchema,
} from "@/lib/repos/scenarioObjectiveRepo";
import type { ScenarioObjectiveCreate } from "@/lib/repos/scenarioObjectiveRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => scenarioObjectiveRepo.list(),
    (e: unknown) =>
      log.error("api.scenario_objectives.list.failed", {
        message: "Failed to list scenario_objectives",
        subject: { entityType: "scenario_objectives" },
        error: e,
      }),
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = ScenarioObjectiveCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as ScenarioObjectiveCreate;
  return handle(
    () => scenarioObjectiveRepo.create(payload),
    (e: unknown) =>
      log.error("api.scenario_objectives.create.failed", {
        message: "Failed to create scenarioObjective",
        subject: { entityType: "scenario_objectives" },
        context: { body: json },
        error: e,
      }),
  );
}
