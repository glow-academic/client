// utils/mutations/simulation_chat_grades/update-simulation-chat-grades.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatGrades } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateSimulationChatGrades(
  ids: string[],
  data: Partial<typeof simulationChatGrades.$inferInsert>,
) {
  try {
    return await db
      .update(simulationChatGrades)
      .set(data)
      .where(inArray(simulationChatGrades.id, ids))
      .returning();
  } catch (error) {
    console.error("Error updating multiple simulation_chat_grades:", error);
    throw error;
  }
}
