import { handle } from "@/lib/api/route-factory";
import type { ModelCreate } from "@/lib/repos/modelRepo";
import { ModelCreateSchema, modelRepo } from "@/lib/repos/modelRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => modelRepo.list(),
    (e: unknown) =>
      log.error("api.models.list.failed", {
        message: "Failed to list models",
        subject: { entityType: "models" },
        error: e,
      }),
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = ModelCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as ModelCreate;
  return handle(
    () => modelRepo.create(payload),
    (e: unknown) =>
      log.error("api.models.create.failed", {
        message: "Failed to create model",
        subject: { entityType: "models" },
        context: { body: json },
        error: e,
      }),
  );
}
