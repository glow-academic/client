// utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulation-chat-grades.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatFeedbacks } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getSimulationChatFeedbacksBySimulationChatGrades(simulationChatGradeIds: string[]) {
  try {
    return await db.select().from(simulationChatFeedbacks).where(inArray(simulationChatFeedbacks.simulationChatGradeId, simulationChatGradeIds));
  } catch (error) {
    console.error("Error fetching simulation_chat_feedbacks by simulationChatGrades:", error);
    throw error;
  }
}
