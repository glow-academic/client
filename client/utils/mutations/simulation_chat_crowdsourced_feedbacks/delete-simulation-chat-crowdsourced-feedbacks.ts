// utils/mutations/simulation_chat_crowdsourced_feedbacks/delete-simulation-chat-crowdsourced-feedbacks.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatCrowdsourcedFeedbacks } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteSimulationChatCrowdsourcedFeedbacks(ids: string[]) {
  try {
    return await db.delete(simulationChatCrowdsourcedFeedbacks).where(inArray(simulationChatCrowdsourcedFeedbacks.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple simulation_chat_crowdsourced_feedbacks:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteSimulationChatCrowdsourcedFeedbacks = createMockableAction('deleteSimulationChatCrowdsourcedFeedbacks', _deleteSimulationChatCrowdsourcedFeedbacks);
