import { handle } from "@/lib/api/route-factory";
import { modelRunProfileRepo, ModelRunProfileCreateSchema } from "@/lib/repos/modelRunProfileRepo";
import type { ModelRunProfileCreate } from "@/lib/repos/modelRunProfileRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => modelRunProfileRepo.list(),
    (e: unknown) =>
      log.error("api.model_run_profiles.list.failed", {
        message: "Failed to list model_run_profiles",
        subject: { entityType: "model_run_profiles" },
        error: e,
      })
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = ModelRunProfileCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as ModelRunProfileCreate;
  return handle(
    () => modelRunProfileRepo.create(payload),
    (e: unknown) =>
      log.error("api.model_run_profiles.create.failed", {
        message: "Failed to create modelRunProfile",
        subject: { entityType: "model_run_profiles" },
        context: { body: json },
        error: e,
      })
  );
}
