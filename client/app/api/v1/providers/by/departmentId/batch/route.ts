import { handle } from "@/lib/api/route-factory";
import { providerRepo } from "@/lib/repos/providerRepo";
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
    () => providerRepo.listByDepartments(parsed.data.ids),
    (e: unknown) =>
      log.error("api.providers.by.departmentId.batch.failed", {
        message: "Failed to fetch by foreign key batch",
        subject: { entityType: "providers" },
        context: { foreignKey: "departmentId", count: parsed.data.ids.length },
        error: e,
      }),
  );
}
