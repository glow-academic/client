// utils/mutations/simulation_chat_grades/update-simulationChatGrade.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatGrades } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function updateSimulationChatGrade(id: string, data: Partial<typeof simulationChatGrades.$inferInsert>) {
  try {
    const result = await db.update(simulationChatGrades).set(data).where(eq(simulationChatGrades.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error updating simulationChatGrade:", error);
    throw error;
  }
}
