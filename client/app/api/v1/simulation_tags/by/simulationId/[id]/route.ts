import { handle } from "@/lib/api/route-factory";
import { simulationTagRepo } from "@/lib/repos/simulationTagRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => simulationTagRepo.listBySimulation(id),
    (e: unknown) =>
      log.error("api.simulation_tags.by.simulationId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "simulation_tags" },
        context: { foreignKey: "simulationId", id },
        error: e,
      }),
  );
}
