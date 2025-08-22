import { handle } from "@/lib/api/route-factory";
import { simulationAttemptRepo } from "@/lib/repos/simulationAttemptRepo";
import { z } from "zod";
import { log } from "@/utils/logger";

const Body = z.object({ ids: z.array(z.string()).min(1) });

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  return handle(
    () => simulationAttemptRepo.listByProfiles(parsed.data.ids),
    (e: unknown) =>
      log.error("api.simulation_attempts.by.profileId.batch.failed", {
        message: "Failed to fetch by foreign key batch",
        subject: { entityType: "simulation_attempts" },
        context: { foreignKey: "profileId", count: parsed.data.ids.length },
        error: e,
      })
  );
}
