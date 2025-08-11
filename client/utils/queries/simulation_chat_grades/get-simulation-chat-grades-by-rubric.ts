// utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-rubric.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatGrades } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationChatGradesByRubric(rubricId: string) {
  try {
    return await db.select().from(simulationChatGrades).where(eq(simulationChatGrades.rubricId, rubricId));
  } catch (error) {
    logError("Error fetching simulation_chat_grades by rubric:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationChatGradesByRubric = createMockableAction('getSimulationChatGradesByRubric', _getSimulationChatGradesByRubric);
