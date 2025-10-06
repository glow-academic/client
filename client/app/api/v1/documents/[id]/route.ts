import { handle } from "@/lib/api/route-factory";
import { documentRepo, DocumentUpdateSchema } from "@/lib/repos/documentRepo";
import type { DocumentUpdate } from "@/lib/repos/documentRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => documentRepo.find(id),
    (e: unknown) =>
      log.error("api.documents.get.failed", {
        message: "Failed to fetch document",
        subject: { entityType: "documents", entityId: String(id) },
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
  const parsed = DocumentUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const patch = parsed.data as unknown as DocumentUpdate;
  return handle(
    () => documentRepo.update(id, patch),
    (e: unknown) =>
      log.error("api.documents.patch.failed", {
        message: "Failed to update document",
        subject: { entityType: "documents", entityId: String(id) },
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
      await documentRepo.remove(id);
      return {};
    },
    (e: unknown) =>
      log.error("api.documents.delete.failed", {
        message: "Failed to delete document",
        subject: { entityType: "documents", entityId: String(id) },
        error: e,
      }),
  );
}
