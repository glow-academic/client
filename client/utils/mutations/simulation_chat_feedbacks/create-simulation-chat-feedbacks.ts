// utils/mutations/simulation_chat_feedbacks/create-simulation-chat-feedbacks.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatFeedbacks } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createSimulationChatFeedbacks(data: (typeof simulationChatFeedbacks.$inferInsert)[]) {
  try {
    return await db.insert(simulationChatFeedbacks).values(data).returning();
  } catch (error) {
    await log.error("mutation.create_many.failed", {
      message: "Error creating multiple simulation_chat_feedbacks",
      subject: { entityType: "simulation_chat_feedbacks" },
      context: { function: "_createSimulationChatFeedbacks", file: "utils/mutations/simulation_chat_feedbacks/create-simulation-chat-feedbacks.ts", count: Array.isArray(data) ? data.length : undefined },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createSimulationChatFeedbacks = createMockableAction('createSimulationChatFeedbacks', _createSimulationChatFeedbacks);
