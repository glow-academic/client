import { handle } from "@/lib/api/route-factory";
import {
  simulationAttemptRepo,
  SimulationAttemptCreateSchema,
} from "@/lib/repos/simulationAttemptRepo";
import type { SimulationAttemptCreate } from "@/lib/repos/simulationAttemptRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => simulationAttemptRepo.list(),
    (e: unknown) =>
      log.error("api.simulation_attempts.list.failed", {
        message: "Failed to list simulation_attempts",
        subject: { entityType: "simulation_attempts" },
        error: e,
      }),
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = SimulationAttemptCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const payload = parsed.data as unknown as SimulationAttemptCreate;
  return handle(
    () => simulationAttemptRepo.create(payload),
    (e: unknown) =>
      log.error("api.simulation_attempts.create.failed", {
        message: "Failed to create simulationAttempt",
        subject: { entityType: "simulation_attempts" },
        context: { body: json },
        error: e,
      }),
  );
}
