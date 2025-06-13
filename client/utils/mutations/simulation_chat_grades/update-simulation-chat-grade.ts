// utils/mutations/simulation_chat_grades/update-simulation-chat-grade.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatGrades } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateSimulationChatGrade(id: string, data: Partial<typeof simulationChatGrades.$inferInsert>) {
  try {
    const result = await db.update(simulationChatGrades).set(data).where(eq(simulationChatGrades.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating simulationChatGrade:", error);
    throw error;
  }
}
