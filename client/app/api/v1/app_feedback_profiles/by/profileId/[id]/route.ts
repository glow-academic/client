import { handle } from "@/lib/api/route-factory";
import { appFeedbackProfileRepo } from "@/lib/repos/appFeedbackProfileRepo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => appFeedbackProfileRepo.listByProfile(id),
    (e: unknown) =>
      log.error("api.app_feedback_profiles.by.profileId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "app_feedback_profiles" },
        context: { foreignKey: "profileId", id },
        error: e,
      })
  );
}
