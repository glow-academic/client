// utils/mutations/simulation_chat_grades/delete-simulation-chat-grade.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatGrades } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteSimulationChatGrade(id: string) {
  try {
    const result = await db.delete(simulationChatGrades).where(eq(simulationChatGrades.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting simulationChatGrade:", error);
    throw error;
  }
}
