import { handle } from "@/lib/api/route-factory";
import type { ScenarioUpdate } from "@/lib/repos/scenarioRepo";
import { scenarioRepo, ScenarioUpdateSchema } from "@/lib/repos/scenarioRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handle(
    () => scenarioRepo.find(id),
    (e: unknown) =>
      log.error("api.scenarios.get.failed", {
        message: "Failed to fetch scenario",
        subject: { entityType: "scenarios", entityId: String(id) },
        error: e,
      })
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = ScenarioUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const patch = parsed.data as unknown as ScenarioUpdate;
  return handle(
    () => scenarioRepo.update(id, patch),
    (e: unknown) =>
      log.error("api.scenarios.patch.failed", {
        message: "Failed to update scenario",
        subject: { entityType: "scenarios", entityId: String(id) },
        context: { body: json },
        error: e,
      })
  );
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handle(
    async () => {
      await scenarioRepo.remove(id);
      return {};
    },
    (e: unknown) =>
      log.error("api.scenarios.delete.failed", {
        message: "Failed to delete scenario",
        subject: { entityType: "scenarios", entityId: String(id) },
        error: e,
      })
  );
}
