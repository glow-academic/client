import { handle } from "@/lib/api/route-factory";
import type { SimulationMessageUpdate } from "@/lib/repos/simulationMessageRepo";
import {
  simulationMessageRepo,
  SimulationMessageUpdateSchema,
} from "@/lib/repos/simulationMessageRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handle(
    () => simulationMessageRepo.find(id),
    (e: unknown) =>
      log.error("api.simulation_messages.get.failed", {
        message: "Failed to fetch simulationMessage",
        subject: { entityType: "simulation_messages", entityId: String(id) },
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
  const parsed = SimulationMessageUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const patch = parsed.data as unknown as SimulationMessageUpdate;
  return handle(
    () => simulationMessageRepo.update(id, patch),
    (e: unknown) =>
      log.error("api.simulation_messages.patch.failed", {
        message: "Failed to update simulationMessage",
        subject: { entityType: "simulation_messages", entityId: String(id) },
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
      await simulationMessageRepo.remove(id);
      return {};
    },
    (e: unknown) =>
      log.error("api.simulation_messages.delete.failed", {
        message: "Failed to delete simulationMessage",
        subject: { entityType: "simulation_messages", entityId: String(id) },
        error: e,
      })
  );
}
