import { handle } from "@/lib/api/route-factory";
import { appFeedbackRepo } from "@/lib/repos/appFeedbackRepo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => appFeedbackRepo.listByProfile(id),
    (e: unknown) =>
      log.error("api.app_feedback.by.profileId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "app_feedback" },
        context: { foreignKey: "profileId", id },
        error: e,
      })
  );
}
