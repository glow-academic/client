import { handle } from "@/lib/api/route-factory";
import type { ModelRunCreate } from "@/lib/repos/modelRunRepo";
import { ModelRunCreateSchema, modelRunRepo } from "@/lib/repos/modelRunRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => modelRunRepo.list(),
    (e: unknown) =>
      log.error("api.model_runs.list.failed", {
        message: "Failed to list model_runs",
        subject: { entityType: "model_runs" },
        error: e,
      })
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = ModelRunCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as ModelRunCreate;
  return handle(
    () => modelRunRepo.create(payload),
    (e: unknown) =>
      log.error("api.model_runs.create.failed", {
        message: "Failed to create modelRun",
        subject: { entityType: "model_runs" },
        context: { body: json },
        error: e,
      })
  );
}
