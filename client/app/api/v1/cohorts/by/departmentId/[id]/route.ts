import { handle } from "@/lib/api/route-factory";
import { cohortRepo } from "@/lib/repos/cohortRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => cohortRepo.listByDepartment(id),
    (e: unknown) =>
      log.error("api.cohorts.by.departmentId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "cohorts" },
        context: { foreignKey: "departmentId", id },
        error: e,
      }),
  );
}
