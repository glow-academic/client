import { handle } from "@/lib/api/route-factory";
import {
  modelRunModelRepo,
  ModelRunModelCreateSchema,
} from "@/lib/repos/modelRunModelRepo";
import type { ModelRunModelCreate } from "@/lib/repos/modelRunModelRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => modelRunModelRepo.list(),
    (e: unknown) =>
      log.error("api.model_run_models.list.failed", {
        message: "Failed to list model_run_models",
        subject: { entityType: "model_run_models" },
        error: e,
      }),
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = ModelRunModelCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as ModelRunModelCreate;
  return handle(
    () => modelRunModelRepo.create(payload),
    (e: unknown) =>
      log.error("api.model_run_models.create.failed", {
        message: "Failed to create modelRunModel",
        subject: { entityType: "model_run_models" },
        context: { body: json },
        error: e,
      }),
  );
}
