import { handle } from "@/lib/api/route-factory";
import { departmentAgentRepo } from "@/lib/repos/departmentAgentRepo";
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
    () => departmentAgentRepo.listByDepartments(parsed.data.ids),
    (e: unknown) =>
      log.error("api.department_agents.by.departmentId.batch.failed", {
        message: "Failed to fetch by foreign key batch",
        subject: { entityType: "department_agents" },
        context: { foreignKey: "departmentId", count: parsed.data.ids.length },
        error: e,
      }),
  );
}
