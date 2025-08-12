// utils/mutations/simulation_chat_crowdsourced_feedbacks/create-simulation-chat-crowdsourced-feedbacks.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatCrowdsourcedFeedbacks } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createSimulationChatCrowdsourcedFeedbacks(data: (typeof simulationChatCrowdsourcedFeedbacks.$inferInsert)[]) {
  try {
    return await db.insert(simulationChatCrowdsourcedFeedbacks).values(data).returning();
  } catch (error) {
    await log.error("mutation.create_many.failed", {
      message: "Error creating multiple simulation_chat_crowdsourced_feedbacks",
      subject: { entityType: "simulation_chat_crowdsourced_feedbacks" },
      context: { function: "_createSimulationChatCrowdsourcedFeedbacks", file: "utils/mutations/simulation_chat_crowdsourced_feedbacks/create-simulation-chat-crowdsourced-feedbacks.ts", count: Array.isArray(data) ? data.length : undefined },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createSimulationChatCrowdsourcedFeedbacks = createMockableAction('createSimulationChatCrowdsourcedFeedbacks', _createSimulationChatCrowdsourcedFeedbacks);
