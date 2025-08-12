// utils/mutations/simulation_chat_crowdsourced_feedbacks/delete-simulation-chat-crowdsourced-feedbacks.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatCrowdsourcedFeedbacks } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteSimulationChatCrowdsourcedFeedbacks(ids: string[]) {
  try {
    return await db.delete(simulationChatCrowdsourcedFeedbacks).where(inArray(simulationChatCrowdsourcedFeedbacks.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.delete_many.failed", {
      message: "Error deleting multiple simulation_chat_crowdsourced_feedbacks",
      subject: { entityType: "simulation_chat_crowdsourced_feedbacks" },
      context: { function: "_deleteSimulationChatCrowdsourcedFeedbacks", file: "utils/mutations/simulation_chat_crowdsourced_feedbacks/delete-simulation-chat-crowdsourced-feedbacks.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteSimulationChatCrowdsourcedFeedbacks = createMockableAction('deleteSimulationChatCrowdsourcedFeedbacks', _deleteSimulationChatCrowdsourcedFeedbacks);
