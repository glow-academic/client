// utils/mutations/simulation_chat_crowdsourced_feedbacks/update-simulation-chat-crowdsourced-feedback.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatCrowdsourcedFeedbacks } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateSimulationChatCrowdsourcedFeedback(id: string, data: Partial<typeof simulationChatCrowdsourcedFeedbacks.$inferInsert>) {
  try {
    const result = await db.update(simulationChatCrowdsourcedFeedbacks).set(data).where(eq(simulationChatCrowdsourcedFeedbacks.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating simulationChatCrowdsourcedFeedback:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateSimulationChatCrowdsourcedFeedback = createMockableAction('updateSimulationChatCrowdsourcedFeedback', _updateSimulationChatCrowdsourcedFeedback);
