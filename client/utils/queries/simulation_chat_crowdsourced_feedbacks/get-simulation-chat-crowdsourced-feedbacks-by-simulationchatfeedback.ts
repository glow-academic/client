// utils/queries/simulation_chat_crowdsourced_feedbacks/get-simulation-chat-crowdsourced-feedbacks-by-simulation-chat-feedback.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatCrowdsourcedFeedbacks } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationChatCrowdsourcedFeedbacksBySimulationChatFeedback(simulationChatFeedbackId: string) {
  try {
    return await db.select().from(simulationChatCrowdsourcedFeedbacks).where(eq(simulationChatCrowdsourcedFeedbacks.simulationChatFeedbackId, simulationChatFeedbackId));
  } catch (error) {
    await log.error("query.fetch_by_fk.failed", {
      message: "Error fetching simulation_chat_crowdsourced_feedbacks by simulationChatFeedback",
      subject: { entityType: "simulation_chat_crowdsourced_feedbacks" },
      context: { function: "_getSimulationChatCrowdsourcedFeedbacksBySimulationChatFeedback", file: "utils/queries/simulation_chat_crowdsourced_feedbacks/get-simulation-chat-crowdsourced-feedbacks-by-simulation-chat-feedback.ts", foreignKey: "simulationChatFeedbackId", foreignId: String(simulationChatFeedbackId) },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationChatCrowdsourcedFeedbacksBySimulationChatFeedback = createMockableAction('getSimulationChatCrowdsourcedFeedbacksBySimulationChatFeedback', _getSimulationChatCrowdsourcedFeedbacksBySimulationChatFeedback);
