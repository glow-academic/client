import { handle } from "@/lib/api/route-factory";
import { userProfileRepo } from "@/lib/repos/userProfileRepo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => userProfileRepo.listByUser(+id),
    (e: unknown) =>
      log.error("api.user_profiles.by.userId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "user_profiles" },
        context: { foreignKey: "userId", id },
        error: e,
      })
  );
}
