import { handle } from "@/lib/api/route-factory";
import { modelRunPersonaRepo, ModelRunPersonaCreateSchema } from "@/lib/repos/modelRunPersonaRepo";
import type { ModelRunPersonaCreate } from "@/lib/repos/modelRunPersonaRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => modelRunPersonaRepo.list(),
    (e: unknown) =>
      log.error("api.model_run_personas.list.failed", {
        message: "Failed to list model_run_personas",
        subject: { entityType: "model_run_personas" },
        error: e,
      })
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = ModelRunPersonaCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as ModelRunPersonaCreate;
  return handle(
    () => modelRunPersonaRepo.create(payload),
    (e: unknown) =>
      log.error("api.model_run_personas.create.failed", {
        message: "Failed to create modelRunPersona",
        subject: { entityType: "model_run_personas" },
        context: { body: json },
        error: e,
      })
  );
}
