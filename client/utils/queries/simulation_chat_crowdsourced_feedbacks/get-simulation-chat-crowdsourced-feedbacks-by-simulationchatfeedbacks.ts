// utils/queries/simulation_chat_crowdsourced_feedbacks/get-simulation-chat-crowdsourced-feedbacks-by-simulation-chat-feedbacks.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatCrowdsourcedFeedbacks } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationChatCrowdsourcedFeedbacksBySimulationChatFeedbacks(simulationChatFeedbackIds: string[]) {
  try {
    return await db.select().from(simulationChatCrowdsourcedFeedbacks).where(inArray(simulationChatCrowdsourcedFeedbacks.simulationChatFeedbackId, simulationChatFeedbackIds));
  } catch (error) {
    logError("Error fetching simulation_chat_crowdsourced_feedbacks by simulationChatFeedbacks:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationChatCrowdsourcedFeedbacksBySimulationChatFeedbacks = createMockableAction('getSimulationChatCrowdsourcedFeedbacksBySimulationChatFeedbacks', _getSimulationChatCrowdsourcedFeedbacksBySimulationChatFeedbacks);
