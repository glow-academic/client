// utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedback.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatFeedbacks } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationChatFeedback(id: string) {
  try {
    const result = await db.select().from(simulationChatFeedbacks).where(eq(simulationChatFeedbacks.id, id));
    return result[0] || null;
  } catch (error) {
    await log.error("query.fetch_one.failed", {
      message: "Error fetching simulationChatFeedback",
      subject: { entityType: "simulation_chat_feedbacks", entityId: String(id) },
      context: { function: "_getSimulationChatFeedback", file: "utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedback.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationChatFeedback = createMockableAction('getSimulationChatFeedback', _getSimulationChatFeedback);
