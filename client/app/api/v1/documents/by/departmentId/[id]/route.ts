import { handle } from "@/lib/api/route-factory";
import { documentRepo } from "@/lib/repos/documentRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => documentRepo.listByDepartment(id),
    (e: unknown) =>
      log.error("api.documents.by.departmentId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "documents" },
        context: { foreignKey: "departmentId", id },
        error: e,
      }),
  );
}
