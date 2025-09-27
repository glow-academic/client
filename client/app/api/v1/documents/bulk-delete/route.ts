import { handle } from "@/lib/api/route-factory";
import { documentRepo } from "@/lib/repos/documentRepo";
import { log } from "@/utils/logger";
import { z } from "zod";

const BulkDeleteBody = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export async function DELETE(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = BulkDeleteBody.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  return handle(
    () => documentRepo.removeMany(parsed.data.ids),
    (e: unknown) =>
      log.error("api.documents.bulk_delete.failed", {
        message: "Failed to delete documents in bulk",
        subject: { entityType: "documents" },
        context: { count: parsed.data.ids.length },
        error: e,
      })
  );
}
