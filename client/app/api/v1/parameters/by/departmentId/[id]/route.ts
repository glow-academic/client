import { handle } from "@/lib/api/route-factory";
import { parameterRepo } from "@/lib/repos/parameterRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => parameterRepo.listByDepartment(id),
    (e: unknown) =>
      log.error("api.parameters.by.departmentId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "parameters" },
        context: { foreignKey: "departmentId", id },
        error: e,
      }),
  );
}
