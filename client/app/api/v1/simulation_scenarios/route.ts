import { handle } from "@/lib/api/route-factory";
import {
  simulationScenarioRepo,
  SimulationScenarioCreateSchema,
} from "@/lib/repos/simulationScenarioRepo";
import type { SimulationScenarioCreate } from "@/lib/repos/simulationScenarioRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => simulationScenarioRepo.list(),
    (e: unknown) =>
      log.error("api.simulation_scenarios.list.failed", {
        message: "Failed to list simulation_scenarios",
        subject: { entityType: "simulation_scenarios" },
        error: e,
      }),
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = SimulationScenarioCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as SimulationScenarioCreate;
  return handle(
    () => simulationScenarioRepo.create(payload),
    (e: unknown) =>
      log.error("api.simulation_scenarios.create.failed", {
        message: "Failed to create simulationScenario",
        subject: { entityType: "simulation_scenarios" },
        context: { body: json },
        error: e,
      }),
  );
}
