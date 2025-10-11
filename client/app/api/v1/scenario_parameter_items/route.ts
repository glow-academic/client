import { handle } from "@/lib/api/route-factory";
import { scenarioParameterItemRepo, ScenarioParameterItemCreateSchema } from "@/lib/repos/scenarioParameterItemRepo";
import type { ScenarioParameterItemCreate } from "@/lib/repos/scenarioParameterItemRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => scenarioParameterItemRepo.list(),
    (e: unknown) =>
      log.error("api.scenario_parameter_items.list.failed", {
        message: "Failed to list scenario_parameter_items",
        subject: { entityType: "scenario_parameter_items" },
        error: e,
      })
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = ScenarioParameterItemCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as ScenarioParameterItemCreate;
  return handle(
    () => scenarioParameterItemRepo.create(payload),
    (e: unknown) =>
      log.error("api.scenario_parameter_items.create.failed", {
        message: "Failed to create scenarioParameterItem",
        subject: { entityType: "scenario_parameter_items" },
        context: { body: json },
        error: e,
      })
  );
}
