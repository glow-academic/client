import { handle } from "@/lib/api/route-factory";
import { modelRunProfileRepo } from "@/lib/repos/modelRunProfileRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => modelRunProfileRepo.listByProfile(id),
    (e: unknown) =>
      log.error("api.model_run_profiles.by.profileId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "model_run_profiles" },
        context: { foreignKey: "profileId", id },
        error: e,
      }),
  );
}
