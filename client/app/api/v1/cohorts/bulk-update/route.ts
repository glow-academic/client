import { handle } from "@/lib/api/route-factory";
import { cohortRepo } from "@/lib/repos/cohortRepo";
import { log } from "@/utils/logger";
import { z } from "zod";

const BulkUpdateBody = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().optional(),
        description: z.string().optional(),
        active: z.boolean().optional(),
        profileIds: z.array(z.string()).optional(),
        updatedAt: z.string().optional(),
      })
    )
    .min(1),
});

export async function PATCH(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = BulkUpdateBody.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  return handle(
    () => cohortRepo.updateMany(parsed.data.updates),
    (e: unknown) =>
      log.error("api.cohorts.bulk_update.failed", {
        message: "Failed to update cohorts in bulk",
        subject: { entityType: "cohorts" },
        context: { count: parsed.data.updates.length },
        error: e,
      })
  );
}
