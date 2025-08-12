// utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulation-chat-grade.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatFeedbacks } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationChatFeedbacksBySimulationChatGrade(simulationChatGradeId: string) {
  try {
    return await db.select().from(simulationChatFeedbacks).where(eq(simulationChatFeedbacks.simulationChatGradeId, simulationChatGradeId));
  } catch (error) {
    await log.error("query.fetch_by_fk.failed", {
      message: "Error fetching simulation_chat_feedbacks by simulationChatGrade",
      subject: { entityType: "simulation_chat_feedbacks" },
      context: { function: "_getSimulationChatFeedbacksBySimulationChatGrade", file: "utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulation-chat-grade.ts", foreignKey: "simulationChatGradeId", foreignId: String(simulationChatGradeId) },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationChatFeedbacksBySimulationChatGrade = createMockableAction('getSimulationChatFeedbacksBySimulationChatGrade', _getSimulationChatFeedbacksBySimulationChatGrade);
