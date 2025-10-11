import { handle } from "@/lib/api/route-factory";
import { departmentAgentRepo } from "@/lib/repos/departmentAgentRepo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => departmentAgentRepo.listByDepartment(id),
    (e: unknown) =>
      log.error("api.department_agents.by.departmentId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "department_agents" },
        context: { foreignKey: "departmentId", id },
        error: e,
      })
  );
}
