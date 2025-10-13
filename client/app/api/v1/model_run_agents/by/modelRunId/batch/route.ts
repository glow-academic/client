import { handle } from "@/lib/api/route-factory";
import { modelRunAgentRepo } from "@/lib/repos/modelRunAgentRepo";
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
    () => modelRunAgentRepo.listByModelRuns(parsed.data.ids),
    (e: unknown) =>
      log.error("api.model_run_agents.by.modelRunId.batch.failed", {
        message: "Failed to fetch by foreign key batch",
        subject: { entityType: "model_run_agents" },
        context: { foreignKey: "modelRunId", count: parsed.data.ids.length },
        error: e,
      }),
  );
}
