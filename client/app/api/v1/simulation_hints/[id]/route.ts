import { handle } from "@/lib/api/route-factory";
import type { SimulationHintUpdate } from "@/lib/repos/simulationHintRepo";
import {
  simulationHintRepo,
  SimulationHintUpdateSchema,
} from "@/lib/repos/simulationHintRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handle(
    () => simulationHintRepo.find(id),
    (e: unknown) =>
      log.error("api.simulation_hints.get.failed", {
        message: "Failed to fetch simulationHint",
        subject: { entityType: "simulation_hints", entityId: String(id) },
        error: e,
      })
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = SimulationHintUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const patch = parsed.data as unknown as SimulationHintUpdate;
  return handle(
    () => simulationHintRepo.update(id, patch),
    (e: unknown) =>
      log.error("api.simulation_hints.patch.failed", {
        message: "Failed to update simulationHint",
        subject: { entityType: "simulation_hints", entityId: String(id) },
        context: { body: json },
        error: e,
      })
  );
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handle(
    async () => {
      await simulationHintRepo.remove(id);
      return {};
    },
    (e: unknown) =>
      log.error("api.simulation_hints.delete.failed", {
        message: "Failed to delete simulationHint",
        subject: { entityType: "simulation_hints", entityId: String(id) },
        error: e,
      })
  );
}
