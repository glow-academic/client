import { handle } from "@/lib/api/route-factory";
import { scenarioParameterItemRepo } from "@/lib/repos/scenarioParameterItemRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => scenarioParameterItemRepo.listByParameterItem(id),
    (e: unknown) =>
      log.error("api.scenario_parameter_items.by.parameterItemId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "scenario_parameter_items" },
        context: { foreignKey: "parameterItemId", id },
        error: e,
      }),
  );
}
