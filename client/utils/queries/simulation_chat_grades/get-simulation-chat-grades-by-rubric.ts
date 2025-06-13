// utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-rubric.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatGrades } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getSimulationChatGradesByRubric(rubricId: string) {
  try {
    return await db.select().from(simulationChatGrades).where(eq(simulationChatGrades.rubricId, rubricId));
  } catch (error) {
    logError("Error fetching simulation_chat_grades by rubric:", error);
    throw error;
  }
}
