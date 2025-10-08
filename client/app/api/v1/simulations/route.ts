import { handle } from "@/lib/api/route-factory";
import type { SimulationCreate } from "@/lib/repos/simulationRepo";
import {
  SimulationCreateSchema,
  simulationRepo,
} from "@/lib/repos/simulationRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => simulationRepo.list(),
    (e: unknown) =>
      log.error("api.simulations.list.failed", {
        message: "Failed to list simulations",
        subject: { entityType: "simulations" },
        error: e,
      })
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = SimulationCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as SimulationCreate;
  return handle(
    () => simulationRepo.create(payload),
    (e: unknown) =>
      log.error("api.simulations.create.failed", {
        message: "Failed to create simulation",
        subject: { entityType: "simulations" },
        context: { body: json },
        error: e,
      })
  );
}
