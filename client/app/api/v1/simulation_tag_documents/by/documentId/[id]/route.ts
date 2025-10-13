import { handle } from "@/lib/api/route-factory";
import { simulationTagDocumentRepo } from "@/lib/repos/simulationTagDocumentRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => simulationTagDocumentRepo.listByDocument(id),
    (e: unknown) =>
      log.error("api.simulation_tag_documents.by.documentId.get.failed", {
        message: "Failed to fetch by foreign key",
        subject: { entityType: "simulation_tag_documents" },
        context: { foreignKey: "documentId", id },
        error: e,
      }),
  );
}
