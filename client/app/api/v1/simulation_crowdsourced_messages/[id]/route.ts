import { handle } from "@/lib/api/route-factory";
import {
  simulationCrowdsourcedMessageRepo,
  SimulationCrowdsourcedMessageUpdateSchema,
} from "@/lib/repos/simulationCrowdsourcedMessageRepo";
import type { SimulationCrowdsourcedMessageUpdate } from "@/lib/repos/simulationCrowdsourcedMessageRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => simulationCrowdsourcedMessageRepo.find(id),
    (e: unknown) =>
      log.error("api.simulation_crowdsourced_messages.get.failed", {
        message: "Failed to fetch simulationCrowdsourcedMessage",
        subject: {
          entityType: "simulation_crowdsourced_messages",
          entityId: String(id),
        },
        error: e,
      }),
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = SimulationCrowdsourcedMessageUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const patch = parsed.data as unknown as SimulationCrowdsourcedMessageUpdate;
  return handle(
    () => simulationCrowdsourcedMessageRepo.update(id, patch),
    (e: unknown) =>
      log.error("api.simulation_crowdsourced_messages.patch.failed", {
        message: "Failed to update simulationCrowdsourcedMessage",
        subject: {
          entityType: "simulation_crowdsourced_messages",
          entityId: String(id),
        },
        context: { body: json },
        error: e,
      }),
  );
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    async () => {
      await simulationCrowdsourcedMessageRepo.remove(id);
      return {};
    },
    (e: unknown) =>
      log.error("api.simulation_crowdsourced_messages.delete.failed", {
        message: "Failed to delete simulationCrowdsourcedMessage",
        subject: {
          entityType: "simulation_crowdsourced_messages",
          entityId: String(id),
        },
        error: e,
      }),
  );
}
