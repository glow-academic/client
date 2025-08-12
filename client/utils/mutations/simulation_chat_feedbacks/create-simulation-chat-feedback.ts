// utils/mutations/simulation_chat_feedbacks/create-simulation-chat-feedback.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatFeedbacks } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createSimulationChatFeedback(data: typeof simulationChatFeedbacks.$inferInsert) {
  try {
    const result = await db.insert(simulationChatFeedbacks).values(data).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.create.failed", {
      message: "Error creating simulationChatFeedback",
      subject: { entityType: "simulation_chat_feedbacks" },
      context: { function: "_createSimulationChatFeedback", file: "utils/mutations/simulation_chat_feedbacks/create-simulation-chat-feedback.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createSimulationChatFeedback = createMockableAction('createSimulationChatFeedback', _createSimulationChatFeedback);
