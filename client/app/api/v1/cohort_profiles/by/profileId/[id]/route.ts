import { handle } from "@/lib/api/route-factory";
import { cohortProfileRepo } from "@/lib/repos/cohortProfileRepo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => cohortProfileRepo.listByProfile(id),
    (e: unknown) =>
      log.error("api.cohort_profiles.by.profileId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "cohort_profiles" },
        context: { foreignKey: "profileId", id },
        error: e,
      })
  );
}
