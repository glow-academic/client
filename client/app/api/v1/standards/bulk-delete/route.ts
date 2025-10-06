import { handle } from "@/lib/api/route-factory";
import { standardRepo } from "@/lib/repos/standardRepo";
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
    () => standardRepo.removeMany(parsed.data.ids),
    (e: unknown) =>
      log.error("api.standards.bulk_delete.failed", {
        message: "Failed to delete standards in bulk",
        subject: { entityType: "standards" },
        context: { count: parsed.data.ids.length },
        error: e,
      }),
  );
}
