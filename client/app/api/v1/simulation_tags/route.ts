import { handle } from "@/lib/api/route-factory";
import { simulationTagRepo, SimulationTagCreateSchema } from "@/lib/repos/simulationTagRepo";
import type { SimulationTagCreate } from "@/lib/repos/simulationTagRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => simulationTagRepo.list(),
    (e: unknown) =>
      log.error("api.simulation_tags.list.failed", {
        message: "Failed to list simulation_tags",
        subject: { entityType: "simulation_tags" },
        error: e,
      })
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = SimulationTagCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as SimulationTagCreate;
  return handle(
    () => simulationTagRepo.create(payload),
    (e: unknown) =>
      log.error("api.simulation_tags.create.failed", {
        message: "Failed to create simulationTag",
        subject: { entityType: "simulation_tags" },
        context: { body: json },
        error: e,
      })
  );
}
