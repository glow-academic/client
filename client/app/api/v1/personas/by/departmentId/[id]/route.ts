import { handle } from "@/lib/api/route-factory";
import { personaRepo } from "@/lib/repos/personaRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => personaRepo.listByDepartment(id),
    (e: unknown) =>
      log.error("api.personas.by.departmentId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "personas" },
        context: { foreignKey: "departmentId", id },
        error: e,
      }),
  );
}
