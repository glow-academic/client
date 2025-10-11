import { handle } from "@/lib/api/route-factory";
import { departmentAgentRepo, DepartmentAgentCreateSchema } from "@/lib/repos/departmentAgentRepo";
import type { DepartmentAgentCreate } from "@/lib/repos/departmentAgentRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => departmentAgentRepo.list(),
    (e: unknown) =>
      log.error("api.department_agents.list.failed", {
        message: "Failed to list department_agents",
        subject: { entityType: "department_agents" },
        error: e,
      })
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = DepartmentAgentCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as DepartmentAgentCreate;
  return handle(
    () => departmentAgentRepo.create(payload),
    (e: unknown) =>
      log.error("api.department_agents.create.failed", {
        message: "Failed to create departmentAgent",
        subject: { entityType: "department_agents" },
        context: { body: json },
        error: e,
      })
  );
}
