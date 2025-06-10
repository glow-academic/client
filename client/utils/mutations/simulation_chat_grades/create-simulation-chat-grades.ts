// utils/mutations/simulation_chat_grades/create-simulation-chat-grades.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatGrades } from "@/drizzle/schema";

export async function createSimulationChatGrades(
  data: (typeof simulationChatGrades.$inferInsert)[],
) {
  try {
    return await db.insert(simulationChatGrades).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple simulation_chat_grades:", error);
    throw error;
  }
}
