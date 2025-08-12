// utils/queries/simulation_chat_crowdsourced_feedbacks/get-simulation-chat-crowdsourced-feedbacks-by-simulation-chat-feedbacks.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatCrowdsourcedFeedbacks } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationChatCrowdsourcedFeedbacksBySimulationChatFeedbacks(simulationChatFeedbackIds: string[]) {
  try {
    return await db.select().from(simulationChatCrowdsourcedFeedbacks).where(inArray(simulationChatCrowdsourcedFeedbacks.simulationChatFeedbackId, simulationChatFeedbackIds));
  } catch (error) {
    await log.error("query.fetch_by_fk_plural.failed", {
      message: "Error fetching simulation_chat_crowdsourced_feedbacks by simulationChatFeedbacks",
      subject: { entityType: "simulation_chat_crowdsourced_feedbacks" },
      context: { function: "_getSimulationChatCrowdsourcedFeedbacksBySimulationChatFeedbacks", file: "utils/queries/simulation_chat_crowdsourced_feedbacks/get-simulation-chat-crowdsourced-feedbacks-by-simulation-chat-feedbacks.ts", foreignKey: "simulationChatFeedbackId", foreignIdsCount: simulationChatFeedbackIds.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationChatCrowdsourcedFeedbacksBySimulationChatFeedbacks = createMockableAction('getSimulationChatCrowdsourcedFeedbacksBySimulationChatFeedbacks', _getSimulationChatCrowdsourcedFeedbacksBySimulationChatFeedbacks);
