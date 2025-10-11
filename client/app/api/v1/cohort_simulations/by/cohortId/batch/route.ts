import { handle } from "@/lib/api/route-factory";
import { cohortSimulationRepo } from "@/lib/repos/cohortSimulationRepo";
import { z } from "zod";
import { log } from "@/utils/logger";

const Body = z.object({ ids: z.array(z.string()).min(1) });

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  return handle(
    () => cohortSimulationRepo.listByCohorts(parsed.data.ids),
    (e: unknown) =>
      log.error("api.cohort_simulations.by.cohortId.batch.failed", {
        message: "Failed to fetch by foreign key batch",
        subject: { entityType: "cohort_simulations" },
        context: { foreignKey: "cohortId", count: parsed.data.ids.length },
        error: e,
      })
  );
}
