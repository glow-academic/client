// utils/mutations/simulation_chat_grades/create-simulation-chat-grade.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatGrades } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createSimulationChatGrade(
  data: typeof simulationChatGrades.$inferInsert,
) {
  try {
    const result = await db
      .insert(simulationChatGrades)
      .values(data)
      .returning();
    return result[0];
  } catch (error) {
    logError("Error creating simulationChatGrade:", error);
    throw error;
  }
}
