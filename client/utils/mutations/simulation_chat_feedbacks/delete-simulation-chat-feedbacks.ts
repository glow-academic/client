// utils/mutations/simulation_chat_feedbacks/delete-simulation-chat-feedbacks.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatFeedbacks } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteSimulationChatFeedbacks(ids: string[]) {
  try {
    return await db.delete(simulationChatFeedbacks).where(inArray(simulationChatFeedbacks.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.delete_many.failed", {
      message: "Error deleting multiple simulation_chat_feedbacks",
      subject: { entityType: "simulation_chat_feedbacks" },
      context: { function: "_deleteSimulationChatFeedbacks", file: "utils/mutations/simulation_chat_feedbacks/delete-simulation-chat-feedbacks.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteSimulationChatFeedbacks = createMockableAction('deleteSimulationChatFeedbacks', _deleteSimulationChatFeedbacks);
