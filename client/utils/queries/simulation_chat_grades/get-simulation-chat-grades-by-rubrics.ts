// utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatGrades } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationChatGradesByRubrics(rubricIds: string[]) {
  try {
    return await db.select().from(simulationChatGrades).where(inArray(simulationChatGrades.rubricId, rubricIds));
  } catch (error) {
    await log.error("query.fetch_by_fk_plural.failed", {
      message: "Error fetching simulation_chat_grades by rubrics",
      subject: { entityType: "simulation_chat_grades" },
      context: { function: "_getSimulationChatGradesByRubrics", file: "utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-rubrics.ts", foreignKey: "rubricId", foreignIdsCount: rubricIds.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationChatGradesByRubrics = createMockableAction('getSimulationChatGradesByRubrics', _getSimulationChatGradesByRubrics);
