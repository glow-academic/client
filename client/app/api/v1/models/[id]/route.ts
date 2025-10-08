import { handle } from "@/lib/api/route-factory";
import type { ModelUpdate } from "@/lib/repos/modelRepo";
import { modelRepo, ModelUpdateSchema } from "@/lib/repos/modelRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handle(
    () => modelRepo.find(id),
    (e: unknown) =>
      log.error("api.models.get.failed", {
        message: "Failed to fetch model",
        subject: { entityType: "models", entityId: String(id) },
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
  const parsed = ModelUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const patch = parsed.data as unknown as ModelUpdate;
  return handle(
    () => modelRepo.update(id, patch),
    (e: unknown) =>
      log.error("api.models.patch.failed", {
        message: "Failed to update model",
        subject: { entityType: "models", entityId: String(id) },
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
      await modelRepo.remove(id);
      return {};
    },
    (e: unknown) =>
      log.error("api.models.delete.failed", {
        message: "Failed to delete model",
        subject: { entityType: "models", entityId: String(id) },
        error: e,
      })
  );
}
