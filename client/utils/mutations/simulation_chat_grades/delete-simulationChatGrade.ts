// utils/mutations/simulation_chat_grades/delete-simulationChatGrade.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatGrades } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function deleteSimulationChatGrade(id: string) {
  try {
    const result = await db.delete(simulationChatGrades).where(eq(simulationChatGrades.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error deleting simulationChatGrade:", error);
    throw error;
  }
}
