// utils/mutations/simulation_chat_grades/update-simulation-chat-grades.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatGrades } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

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
    logError("Error updating multiple simulation_chat_grades:", error);
    throw error;
  }
}
