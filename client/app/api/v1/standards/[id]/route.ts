import { handle } from "@/lib/api/route-factory";
import { standardRepo, StandardUpdateSchema } from "@/lib/repos/standardRepo";
import type { StandardUpdate } from "@/lib/repos/standardRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => standardRepo.find(id),
    (e: unknown) =>
      log.error("api.standards.get.failed", {
        message: "Failed to fetch standard",
        subject: { entityType: "standards", entityId: String(id) },
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
  const parsed = StandardUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const patch = parsed.data as unknown as StandardUpdate;
  return handle(
    () => standardRepo.update(id, patch),
    (e: unknown) =>
      log.error("api.standards.patch.failed", {
        message: "Failed to update standard",
        subject: { entityType: "standards", entityId: String(id) },
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
      await standardRepo.remove(id);
      return {};
    },
    (e: unknown) =>
      log.error("api.standards.delete.failed", {
        message: "Failed to delete standard",
        subject: { entityType: "standards", entityId: String(id) },
        error: e,
      }),
  );
}
