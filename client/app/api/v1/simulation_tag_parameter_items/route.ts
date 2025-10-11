import { handle } from "@/lib/api/route-factory";
import { simulationTagParameterItemRepo, SimulationTagParameterItemCreateSchema } from "@/lib/repos/simulationTagParameterItemRepo";
import type { SimulationTagParameterItemCreate } from "@/lib/repos/simulationTagParameterItemRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => simulationTagParameterItemRepo.list(),
    (e: unknown) =>
      log.error("api.simulation_tag_parameter_items.list.failed", {
        message: "Failed to list simulation_tag_parameter_items",
        subject: { entityType: "simulation_tag_parameter_items" },
        error: e,
      })
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = SimulationTagParameterItemCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as SimulationTagParameterItemCreate;
  return handle(
    () => simulationTagParameterItemRepo.create(payload),
    (e: unknown) =>
      log.error("api.simulation_tag_parameter_items.create.failed", {
        message: "Failed to create simulationTagParameterItem",
        subject: { entityType: "simulation_tag_parameter_items" },
        context: { body: json },
        error: e,
      })
  );
}
