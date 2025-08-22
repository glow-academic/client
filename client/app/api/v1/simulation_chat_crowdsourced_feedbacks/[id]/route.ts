import { handle } from "@/lib/api/route-factory";
import { simulationChatCrowdsourcedFeedbackRepo, SimulationChatCrowdsourcedFeedbackUpdateSchema } from "@/lib/repos/simulationChatCrowdsourcedFeedbackRepo";
import type { SimulationChatCrowdsourcedFeedbackUpdate } from "@/lib/repos/simulationChatCrowdsourcedFeedbackRepo";
import { log } from "@/utils/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    () => simulationChatCrowdsourcedFeedbackRepo.find(id),
    (e: unknown) =>
      log.error("api.simulation_chat_crowdsourced_feedbacks.get.failed", {
        message: "Failed to fetch simulationChatCrowdsourcedFeedback",
        subject: { entityType: "simulation_chat_crowdsourced_feedbacks", entityId: String(id) },
        error: e,
      })
  );
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = SimulationChatCrowdsourcedFeedbackUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const patch = parsed.data as unknown as SimulationChatCrowdsourcedFeedbackUpdate;
  return handle(
    () => simulationChatCrowdsourcedFeedbackRepo.update(id, patch),
    (e: unknown) =>
      log.error("api.simulation_chat_crowdsourced_feedbacks.patch.failed", {
        message: "Failed to update simulationChatCrowdsourcedFeedback",
        subject: { entityType: "simulation_chat_crowdsourced_feedbacks", entityId: String(id) },
        context: { body: json },
        error: e,
      })
  );
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handle(
    async () => { await simulationChatCrowdsourcedFeedbackRepo.remove(id); return {}; },
    (e: unknown) =>
      log.error("api.simulation_chat_crowdsourced_feedbacks.delete.failed", {
        message: "Failed to delete simulationChatCrowdsourcedFeedback",
        subject: { entityType: "simulation_chat_crowdsourced_feedbacks", entityId: String(id) },
        error: e,
      })
  );
}
