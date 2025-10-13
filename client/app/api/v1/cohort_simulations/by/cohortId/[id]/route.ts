import { handle } from "@/lib/api/route-factory";
import { cohortSimulationRepo } from "@/lib/repos/cohortSimulationRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => cohortSimulationRepo.listByCohort(id),
    (e: unknown) =>
      log.error("api.cohort_simulations.by.cohortId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "cohort_simulations" },
        context: { foreignKey: "cohortId", id },
        error: e,
      }),
  );
}
