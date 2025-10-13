import { handle } from "@/lib/api/route-factory";
import type { SimulationHintCreate } from "@/lib/repos/simulationHintRepo";
import {
  SimulationHintCreateSchema,
  simulationHintRepo,
} from "@/lib/repos/simulationHintRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => simulationHintRepo.list(),
    (e: unknown) =>
      log.error("api.simulation_hints.list.failed", {
        message: "Failed to list simulation_hints",
        subject: { entityType: "simulation_hints" },
        error: e,
      }),
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = SimulationHintCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as SimulationHintCreate;
  return handle(
    () => simulationHintRepo.create(payload),
    (e: unknown) =>
      log.error("api.simulation_hints.create.failed", {
        message: "Failed to create simulationHint",
        subject: { entityType: "simulation_hints" },
        context: { body: json },
        error: e,
      }),
  );
}
