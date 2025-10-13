import { handle } from "@/lib/api/route-factory";
import { simulationTagParameterItemRepo } from "@/lib/repos/simulationTagParameterItemRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => simulationTagParameterItemRepo.listByParameterItem(id),
    (e: unknown) =>
      log.error(
        "api.simulation_tag_parameter_items.by.parameterItemId.get.failed",
        {
          message: "Failed to fetch by foreign key",
          subject: { entityType: "simulation_tag_parameter_items" },
          context: { foreignKey: "parameterItemId", id },
          error: e,
        },
      ),
  );
}
