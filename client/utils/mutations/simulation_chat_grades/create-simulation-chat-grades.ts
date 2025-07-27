// utils/mutations/simulation_chat_grades/create-simulation-chat-grades.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatGrades } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createSimulationChatGrades(
  data: (typeof simulationChatGrades.$inferInsert)[],
) {
  try {
    return await db.insert(simulationChatGrades).values(data).returning();
  } catch (error) {
    logError("Error creating multiple simulation_chat_grades:", error);
    throw error;
  }
}
