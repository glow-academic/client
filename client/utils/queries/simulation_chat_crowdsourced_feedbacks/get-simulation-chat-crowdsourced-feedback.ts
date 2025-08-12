// utils/queries/simulation_chat_crowdsourced_feedbacks/get-simulation-chat-crowdsourced-feedback.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatCrowdsourcedFeedbacks } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationChatCrowdsourcedFeedback(id: string) {
  try {
    const result = await db.select().from(simulationChatCrowdsourcedFeedbacks).where(eq(simulationChatCrowdsourcedFeedbacks.id, id));
    return result[0] || null;
  } catch (error) {
    await log.error("query.fetch_one.failed", {
      message: "Error fetching simulationChatCrowdsourcedFeedback",
      subject: { entityType: "simulation_chat_crowdsourced_feedbacks", entityId: String(id) },
      context: { function: "_getSimulationChatCrowdsourcedFeedback", file: "utils/queries/simulation_chat_crowdsourced_feedbacks/get-simulation-chat-crowdsourced-feedback.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationChatCrowdsourcedFeedback = createMockableAction('getSimulationChatCrowdsourcedFeedback', _getSimulationChatCrowdsourcedFeedback);
