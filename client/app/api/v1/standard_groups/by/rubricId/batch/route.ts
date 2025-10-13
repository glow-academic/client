import { handle } from "@/lib/api/route-factory";
import { standardGroupRepo } from "@/lib/repos/standardGroupRepo";
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
    () => standardGroupRepo.listByRubrics(parsed.data.ids),
    (e: unknown) =>
      log.error("api.standard_groups.by.rubricId.batch.failed", {
        message: "Failed to fetch by foreign key batch",
        subject: { entityType: "standard_groups" },
        context: { foreignKey: "rubricId", count: parsed.data.ids.length },
        error: e,
      }),
  );
}
