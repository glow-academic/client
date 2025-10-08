import { handle } from "@/lib/api/route-factory";
import { simulationChatRepo } from "@/lib/repos/simulationChatRepo";
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
    () => simulationChatRepo.listByScenarios(parsed.data.ids),
    (e: unknown) =>
      log.error("api.simulation_chats.by.scenarioId.batch.failed", {
        message: "Failed to fetch by foreign key batch",
        subject: { entityType: "simulation_chats" },
        context: { foreignKey: "scenarioId", count: parsed.data.ids.length },
        error: e,
      })
  );
}
