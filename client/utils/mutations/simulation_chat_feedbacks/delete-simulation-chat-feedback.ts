// utils/mutations/simulation_chat_feedbacks/delete-simulation-chat-feedback.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatFeedbacks } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteSimulationChatFeedback(id: string) {
  try {
    const result = await db.delete(simulationChatFeedbacks).where(eq(simulationChatFeedbacks.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.delete.failed", {
      message: "Error deleting simulationChatFeedback",
      subject: { entityType: "simulation_chat_feedbacks", entityId: String(id) },
      context: { function: "_deleteSimulationChatFeedback", file: "utils/mutations/simulation_chat_feedbacks/delete-simulation-chat-feedback.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteSimulationChatFeedback = createMockableAction('deleteSimulationChatFeedback', _deleteSimulationChatFeedback);
