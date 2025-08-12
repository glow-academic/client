// utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulation-chat-grades.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatFeedbacks } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationChatFeedbacksBySimulationChatGrades(simulationChatGradeIds: string[]) {
  try {
    return await db.select().from(simulationChatFeedbacks).where(inArray(simulationChatFeedbacks.simulationChatGradeId, simulationChatGradeIds));
  } catch (error) {
    await log.error("query.fetch_by_fk_plural.failed", {
      message: "Error fetching simulation_chat_feedbacks by simulationChatGrades",
      subject: { entityType: "simulation_chat_feedbacks" },
      context: { function: "_getSimulationChatFeedbacksBySimulationChatGrades", file: "utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulation-chat-grades.ts", foreignKey: "simulationChatGradeId", foreignIdsCount: simulationChatGradeIds.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationChatFeedbacksBySimulationChatGrades = createMockableAction('getSimulationChatFeedbacksBySimulationChatGrades', _getSimulationChatFeedbacksBySimulationChatGrades);
