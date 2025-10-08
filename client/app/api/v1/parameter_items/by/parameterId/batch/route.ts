import { handle } from "@/lib/api/route-factory";
import { parameterItemRepo } from "@/lib/repos/parameterItemRepo";
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
    () => parameterItemRepo.listByParameters(parsed.data.ids),
    (e: unknown) =>
      log.error("api.parameter_items.by.parameterId.batch.failed", {
        message: "Failed to fetch by foreign key batch",
        subject: { entityType: "parameter_items" },
        context: { foreignKey: "parameterId", count: parsed.data.ids.length },
        error: e,
      })
  );
}
