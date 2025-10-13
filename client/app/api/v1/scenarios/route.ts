import { handle } from "@/lib/api/route-factory";
import type { ScenarioCreate } from "@/lib/repos/scenarioRepo";
import { ScenarioCreateSchema, scenarioRepo } from "@/lib/repos/scenarioRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => scenarioRepo.list(),
    (e: unknown) =>
      log.error("api.scenarios.list.failed", {
        message: "Failed to list scenarios",
        subject: { entityType: "scenarios" },
        error: e,
      }),
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = ScenarioCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as ScenarioCreate;
  return handle(
    () => scenarioRepo.create(payload),
    (e: unknown) =>
      log.error("api.scenarios.create.failed", {
        message: "Failed to create scenario",
        subject: { entityType: "scenarios" },
        context: { body: json },
        error: e,
      }),
  );
}
