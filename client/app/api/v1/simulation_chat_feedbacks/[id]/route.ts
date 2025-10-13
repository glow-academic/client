import { handle } from "@/lib/api/route-factory";
import type { SimulationChatFeedbackUpdate } from "@/lib/repos/simulationChatFeedbackRepo";
import {
  simulationChatFeedbackRepo,
  SimulationChatFeedbackUpdateSchema,
} from "@/lib/repos/simulationChatFeedbackRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => simulationChatFeedbackRepo.find(id),
    (e: unknown) =>
      log.error("api.simulation_chat_feedbacks.get.failed", {
        message: "Failed to fetch simulationChatFeedback",
        subject: {
          entityType: "simulation_chat_feedbacks",
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
  const parsed = SimulationChatFeedbackUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const patch = parsed.data as unknown as SimulationChatFeedbackUpdate;
  return handle(
    () => simulationChatFeedbackRepo.update(id, patch),
    (e: unknown) =>
      log.error("api.simulation_chat_feedbacks.patch.failed", {
        message: "Failed to update simulationChatFeedback",
        subject: {
          entityType: "simulation_chat_feedbacks",
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
      await simulationChatFeedbackRepo.remove(id);
      return {};
    },
    (e: unknown) =>
      log.error("api.simulation_chat_feedbacks.delete.failed", {
        message: "Failed to delete simulationChatFeedback",
        subject: {
          entityType: "simulation_chat_feedbacks",
          entityId: String(id),
        },
        error: e,
      }),
  );
}
