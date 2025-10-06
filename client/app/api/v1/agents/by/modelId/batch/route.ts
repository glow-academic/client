import { handle } from "@/lib/api/route-factory";
import { agentRepo } from "@/lib/repos/agentRepo";
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
    () => agentRepo.listByModels(parsed.data.ids),
    (e: unknown) =>
      log.error("api.agents.by.modelId.batch.failed", {
        message: "Failed to fetch by foreign key batch",
        subject: { entityType: "agents" },
        context: { foreignKey: "modelId", count: parsed.data.ids.length },
        error: e,
      }),
  );
}
