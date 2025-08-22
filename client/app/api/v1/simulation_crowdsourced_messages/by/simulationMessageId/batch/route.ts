import { handle } from "@/lib/api/route-factory";
import { simulationCrowdsourcedMessageRepo } from "@/lib/repos/simulationCrowdsourcedMessageRepo";
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
    () => simulationCrowdsourcedMessageRepo.listBySimulationMessages(parsed.data.ids),
    (e: unknown) =>
      log.error("api.simulation_crowdsourced_messages.by.simulationMessageId.batch.failed", {
        message: "Failed to fetch by foreign key batch",
        subject: { entityType: "simulation_crowdsourced_messages" },
        context: { foreignKey: "simulationMessageId", count: parsed.data.ids.length },
        error: e,
      })
  );
}
