// utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedback.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatFeedbacks } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationChatFeedback(id: string) {
  try {
    const result = await db.select().from(simulationChatFeedbacks).where(eq(simulationChatFeedbacks.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching simulationChatFeedback:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationChatFeedback = createMockableAction('getSimulationChatFeedback', _getSimulationChatFeedback);
