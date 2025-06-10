// utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationChatGrades } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getSimulationChatGradesByRubrics(rubricIds: string[]) {
  try {
    return await db
      .select()
      .from(simulationChatGrades)
      .where(inArray(simulationChatGrades.rubricId, rubricIds));
  } catch (error) {
    console.error("Error fetching simulation_chat_grades by rubrics:", error);
    throw error;
  }
}
