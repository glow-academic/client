import { handle } from "@/lib/api/route-factory";
import { scenarioRepo } from "@/lib/repos/scenarioRepo";
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
    () => scenarioRepo.listByPersonas(parsed.data.ids),
    (e: unknown) =>
      log.error("api.scenarios.by.personaId.batch.failed", {
        message: "Failed to fetch by foreign key batch",
        subject: { entityType: "scenarios" },
        context: { foreignKey: "personaId", count: parsed.data.ids.length },
        error: e,
      })
  );
}
