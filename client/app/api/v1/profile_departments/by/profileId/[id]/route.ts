import { handle } from "@/lib/api/route-factory";
import { profileDepartmentRepo } from "@/lib/repos/profileDepartmentRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => profileDepartmentRepo.listByProfile(id),
    (e: unknown) =>
      log.error("api.profile_departments.by.profileId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "profile_departments" },
        context: { foreignKey: "profileId", id },
        error: e,
      }),
  );
}
