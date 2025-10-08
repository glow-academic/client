import { handle } from "@/lib/api/route-factory";
import { profileRepo } from "@/lib/repos/profileRepo";
import { log } from "@/utils/logger";
import { z } from "zod";

const BulkDeleteBody = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export async function DELETE(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = BulkDeleteBody.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  return handle(
    () => profileRepo.removeMany(parsed.data.ids),
    (e: unknown) =>
      log.error("api.profiles.bulk_delete.failed", {
        message: "Failed to delete profiles in bulk",
        subject: { entityType: "profiles" },
        context: { count: parsed.data.ids.length },
        error: e,
      })
  );
}
