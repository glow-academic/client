import { handle } from "@/lib/api/route-factory";
import { modelRunRepo } from "@/lib/repos/modelRunRepo";
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
    () => modelRunRepo.listByModels(parsed.data.ids),
    (e: unknown) =>
      log.error("api.model_runs.by.modelId.batch.failed", {
        message: "Failed to fetch by foreign key batch",
        subject: { entityType: "model_runs" },
        context: { foreignKey: "modelId", count: parsed.data.ids.length },
        error: e,
      })
  );
}
