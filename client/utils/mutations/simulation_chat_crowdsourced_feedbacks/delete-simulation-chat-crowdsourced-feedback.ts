// utils/mutations/simulation_chat_crowdsourced_feedbacks/delete-simulation-chat-crowdsourced-feedback.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatCrowdsourcedFeedbacks } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteSimulationChatCrowdsourcedFeedback(id: string) {
  try {
    const result = await db.delete(simulationChatCrowdsourcedFeedbacks).where(eq(simulationChatCrowdsourcedFeedbacks.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.delete.failed", {
      message: "Error deleting simulationChatCrowdsourcedFeedback",
      subject: { entityType: "simulation_chat_crowdsourced_feedbacks", entityId: String(id) },
      context: { function: "_deleteSimulationChatCrowdsourcedFeedback", file: "utils/mutations/simulation_chat_crowdsourced_feedbacks/delete-simulation-chat-crowdsourced-feedback.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteSimulationChatCrowdsourcedFeedback = createMockableAction('deleteSimulationChatCrowdsourcedFeedback', _deleteSimulationChatCrowdsourcedFeedback);
