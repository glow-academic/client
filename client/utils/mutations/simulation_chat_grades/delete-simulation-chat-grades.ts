// utils/mutations/simulation_chat_grades/delete-simulation-chat-grades.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatGrades } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteSimulationChatGrades(ids: string[]) {
  try {
    return await db.delete(simulationChatGrades).where(inArray(simulationChatGrades.id, ids)).returning();
  } catch (error) {
    console.error("Error deleting multiple simulation_chat_grades:", error);
    throw error;
  }
}
