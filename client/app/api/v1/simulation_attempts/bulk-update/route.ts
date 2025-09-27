import { handle } from "@/lib/api/route-factory";
import { simulationAttemptRepo } from "@/lib/repos/simulationAttemptRepo";
import { log } from "@/utils/logger";
import { z } from "zod";

const BulkUpdateBody = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().min(1),
        archived: z.boolean().optional(),
        infiniteMode: z.boolean().optional(),
        infiniteModeTimeLimit: z.number().optional(),
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
    () => simulationAttemptRepo.updateMany(parsed.data.updates),
    (e: unknown) =>
      log.error("api.simulation_attempts.bulk_update.failed", {
        message: "Failed to update simulation attempts in bulk",
        subject: { entityType: "simulation_attempts" },
        context: { count: parsed.data.updates.length },
        error: e,
      })
  );
}
