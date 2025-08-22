import { handle } from "@/lib/api/route-factory";
import { simulationChatGradeRepo } from "@/lib/repos/simulationChatGradeRepo";
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
    () => simulationChatGradeRepo.listBySimulationChats(parsed.data.ids),
    (e: unknown) =>
      log.error("api.simulation_chat_grades.by.simulationChatId.batch.failed", {
        message: "Failed to fetch by foreign key batch",
        subject: { entityType: "simulation_chat_grades" },
        context: { foreignKey: "simulationChatId", count: parsed.data.ids.length },
        error: e,
      })
  );
}
