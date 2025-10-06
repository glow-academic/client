import { handle } from "@/lib/api/route-factory";
import {
  simulationChatCrowdsourcedFeedbackRepo,
  SimulationChatCrowdsourcedFeedbackCreateSchema,
} from "@/lib/repos/simulationChatCrowdsourcedFeedbackRepo";
import type { SimulationChatCrowdsourcedFeedbackCreate } from "@/lib/repos/simulationChatCrowdsourcedFeedbackRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => simulationChatCrowdsourcedFeedbackRepo.list(),
    (e: unknown) =>
      log.error("api.simulation_chat_crowdsourced_feedbacks.list.failed", {
        message: "Failed to list simulation_chat_crowdsourced_feedbacks",
        subject: { entityType: "simulation_chat_crowdsourced_feedbacks" },
        error: e,
      }),
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = SimulationChatCrowdsourcedFeedbackCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const payload =
    parsed.data as unknown as SimulationChatCrowdsourcedFeedbackCreate;
  return handle(
    () => simulationChatCrowdsourcedFeedbackRepo.create(payload),
    (e: unknown) =>
      log.error("api.simulation_chat_crowdsourced_feedbacks.create.failed", {
        message: "Failed to create simulationChatCrowdsourcedFeedback",
        subject: { entityType: "simulation_chat_crowdsourced_feedbacks" },
        context: { body: json },
        error: e,
      }),
  );
}
