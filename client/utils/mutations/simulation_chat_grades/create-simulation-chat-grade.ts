// utils/mutations/simulation_chat_grades/create-simulation-chat-grade.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatGrades } from "@/drizzle/schema";

export async function createSimulationChatGrade(data: typeof simulationChatGrades.$inferInsert) {
  try {
    const result = await db.insert(simulationChatGrades).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating simulationChatGrade:", error);
    throw error;
  }
}
