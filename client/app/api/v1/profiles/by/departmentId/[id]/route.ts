import { handle } from "@/lib/api/route-factory";
import { profileRepo } from "@/lib/repos/profileRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => profileRepo.listByDepartment(id),
    (e: unknown) =>
      log.error("api.profiles.by.departmentId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "profiles" },
        context: { foreignKey: "departmentId", id },
        error: e,
      }),
  );
}
