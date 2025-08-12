// utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-standards.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatFeedbacks } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationChatFeedbacksByStandards(standardIds: string[]) {
  try {
    return await db.select().from(simulationChatFeedbacks).where(inArray(simulationChatFeedbacks.standardId, standardIds));
  } catch (error) {
    await log.error("query.fetch_by_fk_plural.failed", {
      message: "Error fetching simulation_chat_feedbacks by standards",
      subject: { entityType: "simulation_chat_feedbacks" },
      context: { function: "_getSimulationChatFeedbacksByStandards", file: "utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-standards.ts", foreignKey: "standardId", foreignIdsCount: standardIds.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationChatFeedbacksByStandards = createMockableAction('getSimulationChatFeedbacksByStandards', _getSimulationChatFeedbacksByStandards);
