import { handle } from "@/lib/api/route-factory";
import { scenarioTreeRepo, ScenarioTreeCreateSchema } from "@/lib/repos/scenarioTreeRepo";
import type { ScenarioTreeCreate } from "@/lib/repos/scenarioTreeRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => scenarioTreeRepo.list(),
    (e: unknown) =>
      log.error("api.scenario_tree.list.failed", {
        message: "Failed to list scenario_tree",
        subject: { entityType: "scenario_tree" },
        error: e,
      })
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = ScenarioTreeCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as ScenarioTreeCreate;
  return handle(
    () => scenarioTreeRepo.create(payload),
    (e: unknown) =>
      log.error("api.scenario_tree.create.failed", {
        message: "Failed to create scenarioTree",
        subject: { entityType: "scenario_tree" },
        context: { body: json },
        error: e,
      })
  );
}
