import { handle } from "@/lib/api/route-factory";
import { debugInfoRepo } from "@/lib/repos/debugInfoRepo";
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
    () => debugInfoRepo.listByModelRuns(parsed.data.ids),
    (e: unknown) =>
      log.error("api.debug_info.by.modelRunId.batch.failed", {
        message: "Failed to fetch by foreign key batch",
        subject: { entityType: "debug_info" },
        context: { foreignKey: "modelRunId", count: parsed.data.ids.length },
        error: e,
      })
  );
}
