import { handle } from "@/lib/api/route-factory";
import { simulationAttemptRepo } from "@/lib/repos/simulationAttemptRepo";
import { log } from "@/utils/logger";
import { z } from "zod";

const Body = z.object({ ids: z.array(z.string()).min(1) });

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  return handle(
    () => simulationAttemptRepo.listBySimulations(parsed.data.ids),
    (e: unknown) =>
      log.error("api.simulation_attempts.by.simulationId.batch.failed", {
        message: "Failed to fetch by foreign key batch",
        subject: { entityType: "simulation_attempts" },
        context: { foreignKey: "simulationId", count: parsed.data.ids.length },
        error: e,
      }),
  );
}
