import { handle } from "@/lib/api/route-factory";
import { simulationRepo } from "@/lib/repos/simulationRepo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => simulationRepo.listByRubric(id),
    (e: unknown) =>
      log.error("api.simulations.by.rubricId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "simulations" },
        context: { foreignKey: "rubricId", id },
        error: e,
      })
  );
}
