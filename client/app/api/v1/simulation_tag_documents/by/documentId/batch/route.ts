import { handle } from "@/lib/api/route-factory";
import { simulationTagDocumentRepo } from "@/lib/repos/simulationTagDocumentRepo";
import { z } from "zod";
import { log } from "@/utils/logger";

const Body = z.object({ ids: z.array(z.string()).min(1) });

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  return handle(
    () => simulationTagDocumentRepo.listByDocuments(parsed.data.ids),
    (e: unknown) =>
      log.error("api.simulation_tag_documents.by.documentId.batch.failed", {
        message: "Failed to fetch by foreign key batch",
        subject: { entityType: "simulation_tag_documents" },
        context: { foreignKey: "documentId", count: parsed.data.ids.length },
        error: e,
      })
  );
}
