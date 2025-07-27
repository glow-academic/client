// utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulation-chat-grades.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatFeedbacks } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getSimulationChatFeedbacksBySimulationChatGrades(
  simulationChatGradeIds: string[],
) {
  try {
    return await db
      .select()
      .from(simulationChatFeedbacks)
      .where(
        inArray(
          simulationChatFeedbacks.simulationChatGradeId,
          simulationChatGradeIds,
        ),
      );
  } catch (error) {
    logError(
      "Error fetching simulation_chat_feedbacks by simulationChatGrades:",
      error,
    );
    throw error;
  }
}
