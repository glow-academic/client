import { handle } from "@/lib/api/route-factory";
import { simulationCrowdsourcedMessageRepo } from "@/lib/repos/simulationCrowdsourcedMessageRepo";
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
    () => simulationCrowdsourcedMessageRepo.listByProfiles(parsed.data.ids),
    (e: unknown) =>
      log.error(
        "api.simulation_crowdsourced_messages.by.profileId.batch.failed",
        {
          message: "Failed to fetch by foreign key batch",
          subject: { entityType: "simulation_crowdsourced_messages" },
          context: { foreignKey: "profileId", count: parsed.data.ids.length },
          error: e,
        }
      )
  );
}
