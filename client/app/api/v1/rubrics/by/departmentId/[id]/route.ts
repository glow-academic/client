import { handle } from "@/lib/api/route-factory";
import { rubricRepo } from "@/lib/repos/rubricRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => rubricRepo.listByDepartment(id),
    (e: unknown) =>
      log.error("api.rubrics.by.departmentId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "rubrics" },
        context: { foreignKey: "departmentId", id },
        error: e,
      }),
  );
}
