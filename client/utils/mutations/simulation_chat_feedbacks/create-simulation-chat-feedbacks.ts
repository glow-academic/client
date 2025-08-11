// utils/mutations/simulation_chat_feedbacks/create-simulation-chat-feedbacks.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatFeedbacks } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createSimulationChatFeedbacks(data: (typeof simulationChatFeedbacks.$inferInsert)[]) {
  try {
    return await db.insert(simulationChatFeedbacks).values(data).returning();
  } catch (error) {
    logError("Error creating multiple simulation_chat_feedbacks:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const createSimulationChatFeedbacks = createMockableAction('createSimulationChatFeedbacks', _createSimulationChatFeedbacks);
