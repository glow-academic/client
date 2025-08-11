// utils/mutations/simulation_chat_crowdsourced_feedbacks/create-simulation-chat-crowdsourced-feedback.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatCrowdsourcedFeedbacks } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createSimulationChatCrowdsourcedFeedback(data: typeof simulationChatCrowdsourcedFeedbacks.$inferInsert) {
  try {
    const result = await db.insert(simulationChatCrowdsourcedFeedbacks).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating simulationChatCrowdsourcedFeedback:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const createSimulationChatCrowdsourcedFeedback = createMockableAction('createSimulationChatCrowdsourcedFeedback', _createSimulationChatCrowdsourcedFeedback);
