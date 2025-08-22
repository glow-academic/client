import { handle } from "@/lib/api/route-factory";
import { simulationRepo, SimulationUpdateSchema } from "@/lib/repos/simulationRepo";
import type { SimulationUpdate } from "@/lib/repos/simulationRepo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => simulationRepo.find(id),
    (e: unknown) =>
      log.error("api.simulations.get.failed", {
        message: "Failed to fetch simulation",
        subject: { entityType: "simulations", entityId: String(id) },
        error: e,
      })
  );
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = SimulationUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const patch = parsed.data as unknown as SimulationUpdate;
  return handle(
    () => simulationRepo.update(id, patch),
    (e: unknown) =>
      log.error("api.simulations.patch.failed", {
        message: "Failed to update simulation",
        subject: { entityType: "simulations", entityId: String(id) },
        context: { body: json },
        error: e,
      })
  );
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    async () => { await simulationRepo.remove(id); return {}; },
    (e: unknown) =>
      log.error("api.simulations.delete.failed", {
        message: "Failed to delete simulation",
        subject: { entityType: "simulations", entityId: String(id) },
        error: e,
      })
  );
}
