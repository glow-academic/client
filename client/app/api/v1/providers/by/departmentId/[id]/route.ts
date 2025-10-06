import { handle } from "@/lib/api/route-factory";
import { providerRepo } from "@/lib/repos/providerRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => providerRepo.listByDepartment(id),
    (e: unknown) =>
      log.error("api.providers.by.departmentId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "providers" },
        context: { foreignKey: "departmentId", id },
        error: e,
      }),
  );
}
