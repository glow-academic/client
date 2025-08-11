// utils/mutations/simulation_chat_crowdsourced_feedbacks/update-simulation-chat-crowdsourced-feedbacks.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatCrowdsourcedFeedbacks } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateSimulationChatCrowdsourcedFeedbacks(ids: string[], data: Partial<typeof simulationChatCrowdsourcedFeedbacks.$inferInsert>) {
  try {
    return await db.update(simulationChatCrowdsourcedFeedbacks).set(data).where(inArray(simulationChatCrowdsourcedFeedbacks.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple simulation_chat_crowdsourced_feedbacks:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateSimulationChatCrowdsourcedFeedbacks = createMockableAction('updateSimulationChatCrowdsourcedFeedbacks', _updateSimulationChatCrowdsourcedFeedbacks);
