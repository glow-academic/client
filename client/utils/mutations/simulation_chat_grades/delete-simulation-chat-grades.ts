// utils/mutations/simulation_chat_grades/delete-simulation-chat-grades.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatGrades } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteSimulationChatGrades(ids: string[]) {
  try {
    return await db.delete(simulationChatGrades).where(inArray(simulationChatGrades.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple simulation_chat_grades:", error);
    throw error;
  }
}
