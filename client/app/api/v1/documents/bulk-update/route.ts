import { handle } from "@/lib/api/route-factory";
import {
  documentRepo,
  DocumentUpdateSchema,
  type DocumentUpdate,
} from "@/lib/repos/documentRepo";
import { log } from "@/utils/logger";
import { z } from "zod";

const BulkUpdateBody = z.object({
  updates: z.array(DocumentUpdateSchema).min(1),
});

export async function PATCH(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = BulkUpdateBody.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updates = parsed.data.updates as Array<{ id: string } & DocumentUpdate>;

  return handle(
    () => documentRepo.updateMany(updates),
    (e: unknown) =>
      log.error("api.documents.bulk_update.failed", {
        message: "Failed to update documents in bulk",
        subject: { entityType: "documents" },
        context: { count: updates.length },
        error: e,
      })
  );
}
