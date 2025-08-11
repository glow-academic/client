// utils/queries/simulation_chat_feedbacks/get-all-simulation-chat-feedbacks.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatFeedbacks } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllSimulationChatFeedbacks() {
  try {
    return await db.select().from(simulationChatFeedbacks);
  } catch (error) {
    logError("Error fetching all simulation_chat_feedbacks:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllSimulationChatFeedbacks = createMockableAction('getAllSimulationChatFeedbacks', _getAllSimulationChatFeedbacks);
