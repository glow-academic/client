import { handle } from "@/lib/api/route-factory";
import { attemptProfileRepo } from "@/lib/repos/attemptProfileRepo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => attemptProfileRepo.listBySimulationAttempt(id),
    (e: unknown) =>
      log.error("api.attempt_profiles.by.attemptId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "attempt_profiles" },
        context: { foreignKey: "attemptId", id },
        error: e,
      })
  );
}
