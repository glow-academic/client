import { handle } from "@/lib/api/route-factory";
import { simulationChatFeedbackRepo, SimulationChatFeedbackCreateSchema } from "@/lib/repos/simulationChatFeedbackRepo";
import type { SimulationChatFeedbackCreate } from "@/lib/repos/simulationChatFeedbackRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => simulationChatFeedbackRepo.list(),
    (e: unknown) =>
      log.error("api.simulation_chat_feedbacks.list.failed", {
        message: "Failed to list simulation_chat_feedbacks",
        subject: { entityType: "simulation_chat_feedbacks" },
        error: e,
      })
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = SimulationChatFeedbackCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const payload = parsed.data as unknown as SimulationChatFeedbackCreate;
  return handle(
    () => simulationChatFeedbackRepo.create(payload),
    (e: unknown) =>
      log.error("api.simulation_chat_feedbacks.create.failed", {
        message: "Failed to create simulationChatFeedback",
        subject: { entityType: "simulation_chat_feedbacks" },
        context: { body: json },
        error: e,
      })
  );
}
