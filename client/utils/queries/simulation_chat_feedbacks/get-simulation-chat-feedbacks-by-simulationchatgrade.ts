// utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulation-chat-grade.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatFeedbacks } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getSimulationChatFeedbacksBySimulationChatGrade(simulationChatGradeId: string) {
  try {
    return await db.select().from(simulationChatFeedbacks).where(eq(simulationChatFeedbacks.simulationChatGradeId, simulationChatGradeId));
  } catch (error) {
    logError("Error fetching simulation_chat_feedbacks by simulationChatGrade:", error);
    throw error;
  }
}
