import { handle } from "@/lib/api/route-factory";
import { simulationAttemptRepo, SimulationAttemptUpdateSchema } from "@/lib/repos/simulationAttemptRepo";
import type { SimulationAttemptUpdate } from "@/lib/repos/simulationAttemptRepo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => simulationAttemptRepo.find(id),
    (e: unknown) =>
      log.error("api.simulation_attempts.get.failed", {
        message: "Failed to fetch simulationAttempt",
        subject: { entityType: "simulation_attempts", entityId: String(id) },
        error: e,
      })
  );
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = SimulationAttemptUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const patch = parsed.data as unknown as SimulationAttemptUpdate;
  return handle(
    () => simulationAttemptRepo.update(id, patch),
    (e: unknown) =>
      log.error("api.simulation_attempts.patch.failed", {
        message: "Failed to update simulationAttempt",
        subject: { entityType: "simulation_attempts", entityId: String(id) },
        context: { body: json },
        error: e,
      })
  );
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    async () => { await simulationAttemptRepo.remove(id); return {}; },
    (e: unknown) =>
      log.error("api.simulation_attempts.delete.failed", {
        message: "Failed to delete simulationAttempt",
        subject: { entityType: "simulation_attempts", entityId: String(id) },
        error: e,
      })
  );
}
