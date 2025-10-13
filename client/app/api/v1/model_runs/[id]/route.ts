import { handle } from "@/lib/api/route-factory";
import type { ModelRunUpdate } from "@/lib/repos/modelRunRepo";
import { modelRunRepo, ModelRunUpdateSchema } from "@/lib/repos/modelRunRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => modelRunRepo.find(id),
    (e: unknown) =>
      log.error("api.model_runs.get.failed", {
        message: "Failed to fetch modelRun",
        subject: { entityType: "model_runs", entityId: String(id) },
        error: e,
      }),
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = ModelRunUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const patch = parsed.data as unknown as ModelRunUpdate;
  return handle(
    () => modelRunRepo.update(id, patch),
    (e: unknown) =>
      log.error("api.model_runs.patch.failed", {
        message: "Failed to update modelRun",
        subject: { entityType: "model_runs", entityId: String(id) },
        context: { body: json },
        error: e,
      }),
  );
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    async () => {
      await modelRunRepo.remove(id);
      return {};
    },
    (e: unknown) =>
      log.error("api.model_runs.delete.failed", {
        message: "Failed to delete modelRun",
        subject: { entityType: "model_runs", entityId: String(id) },
        error: e,
      }),
  );
}
