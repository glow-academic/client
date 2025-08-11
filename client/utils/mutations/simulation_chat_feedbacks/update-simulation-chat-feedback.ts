// utils/mutations/simulation_chat_feedbacks/update-simulation-chat-feedback.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatFeedbacks } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateSimulationChatFeedback(id: string, data: Partial<typeof simulationChatFeedbacks.$inferInsert>) {
  try {
    const result = await db.update(simulationChatFeedbacks).set(data).where(eq(simulationChatFeedbacks.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating simulationChatFeedback:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateSimulationChatFeedback = createMockableAction('updateSimulationChatFeedback', _updateSimulationChatFeedback);
