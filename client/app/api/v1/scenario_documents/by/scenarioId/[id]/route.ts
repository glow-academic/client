import { handle } from "@/lib/api/route-factory";
import { scenarioDocumentRepo } from "@/lib/repos/scenarioDocumentRepo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => scenarioDocumentRepo.listByScenario(id),
    (e: unknown) =>
      log.error("api.scenario_documents.by.scenarioId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "scenario_documents" },
        context: { foreignKey: "scenarioId", id },
        error: e,
      })
  );
}
