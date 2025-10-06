import { handle } from "@/lib/api/route-factory";
import { personaRepo } from "@/lib/repos/personaRepo";
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
    () => personaRepo.listByModels(parsed.data.ids),
    (e: unknown) =>
      log.error("api.personas.by.modelId.batch.failed", {
        message: "Failed to fetch by foreign key batch",
        subject: { entityType: "personas" },
        context: { foreignKey: "modelId", count: parsed.data.ids.length },
        error: e,
      }),
  );
}
