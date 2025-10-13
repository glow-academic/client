import { handle } from "@/lib/api/route-factory";
import { simulationTagParameterItemRepo } from "@/lib/repos/simulationTagParameterItemRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => simulationTagParameterItemRepo.listBySimulationTag(id),
    (e: unknown) =>
      log.error(
        "api.simulation_tag_parameter_items.by.simulationId.get.failed",
        {
          message: "Failed to fetch by foreign key",
          subject: { entityType: "simulation_tag_parameter_items" },
          context: { foreignKey: "simulationId", id },
          error: e,
        },
      ),
  );
}
