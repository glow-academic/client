import { handle } from "@/lib/api/route-factory";
import { scenarioTreeRepo } from "@/lib/repos/scenarioTreeRepo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => scenarioTreeRepo.listByScenario(id),
    (e: unknown) =>
      log.error("api.scenario_tree.by.parentId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "scenario_tree" },
        context: { foreignKey: "parentId", id },
        error: e,
      })
  );
}
