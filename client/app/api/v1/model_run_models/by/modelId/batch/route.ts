import { handle } from "@/lib/api/route-factory";
import { modelRunModelRepo } from "@/lib/repos/modelRunModelRepo";
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
    () => modelRunModelRepo.listByModels(parsed.data.ids),
    (e: unknown) =>
      log.error("api.model_run_models.by.modelId.batch.failed", {
        message: "Failed to fetch by foreign key batch",
        subject: { entityType: "model_run_models" },
        context: { foreignKey: "modelId", count: parsed.data.ids.length },
        error: e,
      })
  );
}
