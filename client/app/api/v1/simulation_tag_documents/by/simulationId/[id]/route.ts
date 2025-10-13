import { handle } from "@/lib/api/route-factory";
import { simulationTagDocumentRepo } from "@/lib/repos/simulationTagDocumentRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => simulationTagDocumentRepo.listBySimulationTag(id),
    (e: unknown) =>
      log.error("api.simulation_tag_documents.by.simulationId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "simulation_tag_documents" },
        context: { foreignKey: "simulationId", id },
        error: e,
      }),
  );
}
