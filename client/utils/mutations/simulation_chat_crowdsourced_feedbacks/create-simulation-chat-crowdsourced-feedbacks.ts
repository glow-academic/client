// utils/mutations/simulation_chat_crowdsourced_feedbacks/create-simulation-chat-crowdsourced-feedbacks.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatCrowdsourcedFeedbacks } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createSimulationChatCrowdsourcedFeedbacks(data: (typeof simulationChatCrowdsourcedFeedbacks.$inferInsert)[]) {
  try {
    return await db.insert(simulationChatCrowdsourcedFeedbacks).values(data).returning();
  } catch (error) {
    logError("Error creating multiple simulation_chat_crowdsourced_feedbacks:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const createSimulationChatCrowdsourcedFeedbacks = createMockableAction('createSimulationChatCrowdsourcedFeedbacks', _createSimulationChatCrowdsourcedFeedbacks);
