import { handle } from "@/lib/api/route-factory";
import { simulationMessageRepo } from "@/lib/repos/simulationMessageRepo";
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
    () => simulationMessageRepo.listBySimulationChats(parsed.data.ids),
    (e: unknown) =>
      log.error("api.simulation_messages.by.chatId.batch.failed", {
        message: "Failed to fetch by foreign key batch",
        subject: { entityType: "simulation_messages" },
        context: { foreignKey: "chatId", count: parsed.data.ids.length },
        error: e,
      }),
  );
}
