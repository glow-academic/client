import { handle } from "@/lib/api/route-factory";
import type { SimulationCrowdsourcedMessageCreate } from "@/lib/repos/simulationCrowdsourcedMessageRepo";
import {
  SimulationCrowdsourcedMessageCreateSchema,
  simulationCrowdsourcedMessageRepo,
} from "@/lib/repos/simulationCrowdsourcedMessageRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => simulationCrowdsourcedMessageRepo.list(),
    (e: unknown) =>
      log.error("api.simulation_crowdsourced_messages.list.failed", {
        message: "Failed to list simulation_crowdsourced_messages",
        subject: { entityType: "simulation_crowdsourced_messages" },
        error: e,
      })
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = SimulationCrowdsourcedMessageCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as SimulationCrowdsourcedMessageCreate;
  return handle(
    () => simulationCrowdsourcedMessageRepo.create(payload),
    (e: unknown) =>
      log.error("api.simulation_crowdsourced_messages.create.failed", {
        message: "Failed to create simulationCrowdsourcedMessage",
        subject: { entityType: "simulation_crowdsourced_messages" },
        context: { body: json },
        error: e,
      })
  );
}
