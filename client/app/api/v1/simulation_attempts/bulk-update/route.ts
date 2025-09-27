import { handle } from "@/lib/api/route-factory";
import {
  simulationAttemptRepo,
  SimulationAttemptUpdateSchema,
  type SimulationAttemptUpdate,
} from "@/lib/repos/simulationAttemptRepo";
import { log } from "@/utils/logger";
import { z } from "zod";

const BulkUpdateBody = z.object({
  updates: z.array(SimulationAttemptUpdateSchema).min(1),
});

export async function PATCH(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = BulkUpdateBody.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updates = parsed.data.updates as Array<
    { id: string } & SimulationAttemptUpdate
  >;

  return handle(
    () => simulationAttemptRepo.updateMany(updates),
    (e: unknown) =>
      log.error("api.simulation_attempts.bulk_update.failed", {
        message: "Failed to update simulation attempts in bulk",
        subject: { entityType: "simulation_attempts" },
        context: { count: updates.length },
        error: e,
      })
  );
}
