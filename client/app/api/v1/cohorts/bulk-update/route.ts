import { handle } from "@/lib/api/route-factory";
import {
  cohortRepo,
  CohortUpdateSchema,
  type CohortUpdate,
} from "@/lib/repos/cohortRepo";
import { log } from "@/utils/logger";
import { z } from "zod";

const BulkUpdateBody = z.object({
  updates: z.array(CohortUpdateSchema).min(1),
});

export async function PATCH(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = BulkUpdateBody.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updates = parsed.data.updates as Array<{ id: string } & CohortUpdate>;

  return handle(
    () => cohortRepo.updateMany(updates),
    (e: unknown) =>
      log.error("api.cohorts.bulk_update.failed", {
        message: "Failed to update cohorts in bulk",
        subject: { entityType: "cohorts" },
        context: { count: updates.length },
        error: e,
      })
  );
}
