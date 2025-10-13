import { handle } from "@/lib/api/route-factory";
import { appLogRepo } from "@/lib/repos/appLogRepo";
import { log } from "@/utils/logger";
import { z } from "zod";

const BulkDeleteBody = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});

export async function DELETE(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = BulkDeleteBody.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  return handle(
    () => appLogRepo.removeMany(parsed.data.ids),
    (e: unknown) =>
      log.error("api.app_logs.bulk_delete.failed", {
        message: "Failed to delete app logs in bulk",
        subject: { entityType: "app_logs" },
        context: { count: parsed.data.ids.length },
        error: e,
      }),
  );
}
