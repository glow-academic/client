import { handle } from "@/lib/api/route-factory";
import { modelRunPersonaRepo } from "@/lib/repos/modelRunPersonaRepo";
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
    () => modelRunPersonaRepo.listByPersonas(parsed.data.ids),
    (e: unknown) =>
      log.error("api.model_run_personas.by.personaId.batch.failed", {
        message: "Failed to fetch by foreign key batch",
        subject: { entityType: "model_run_personas" },
        context: { foreignKey: "personaId", count: parsed.data.ids.length },
        error: e,
      }),
  );
}
