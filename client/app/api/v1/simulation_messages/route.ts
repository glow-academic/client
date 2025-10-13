import { handle } from "@/lib/api/route-factory";
import type { SimulationMessageCreate } from "@/lib/repos/simulationMessageRepo";
import {
  SimulationMessageCreateSchema,
  simulationMessageRepo,
} from "@/lib/repos/simulationMessageRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => simulationMessageRepo.list(),
    (e: unknown) =>
      log.error("api.simulation_messages.list.failed", {
        message: "Failed to list simulation_messages",
        subject: { entityType: "simulation_messages" },
        error: e,
      }),
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = SimulationMessageCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as SimulationMessageCreate;
  return handle(
    () => simulationMessageRepo.create(payload),
    (e: unknown) =>
      log.error("api.simulation_messages.create.failed", {
        message: "Failed to create simulationMessage",
        subject: { entityType: "simulation_messages" },
        context: { body: json },
        error: e,
      }),
  );
}
