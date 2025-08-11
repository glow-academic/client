// utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-standard.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatFeedbacks } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationChatFeedbacksByStandard(standardId: string) {
  try {
    return await db.select().from(simulationChatFeedbacks).where(eq(simulationChatFeedbacks.standardId, standardId));
  } catch (error) {
    logError("Error fetching simulation_chat_feedbacks by standard:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationChatFeedbacksByStandard = createMockableAction('getSimulationChatFeedbacksByStandard', _getSimulationChatFeedbacksByStandard);
