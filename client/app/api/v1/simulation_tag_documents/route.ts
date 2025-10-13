import { handle } from "@/lib/api/route-factory";
import {
  simulationTagDocumentRepo,
  SimulationTagDocumentCreateSchema,
} from "@/lib/repos/simulationTagDocumentRepo";
import type { SimulationTagDocumentCreate } from "@/lib/repos/simulationTagDocumentRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => simulationTagDocumentRepo.list(),
    (e: unknown) =>
      log.error("api.simulation_tag_documents.list.failed", {
        message: "Failed to list simulation_tag_documents",
        subject: { entityType: "simulation_tag_documents" },
        error: e,
      }),
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = SimulationTagDocumentCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as SimulationTagDocumentCreate;
  return handle(
    () => simulationTagDocumentRepo.create(payload),
    (e: unknown) =>
      log.error("api.simulation_tag_documents.create.failed", {
        message: "Failed to create simulationTagDocument",
        subject: { entityType: "simulation_tag_documents" },
        context: { body: json },
        error: e,
      }),
  );
}
