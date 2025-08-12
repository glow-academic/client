// utils/mutations/simulation_chat_grades/create-simulation-chat-grade.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatGrades } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createSimulationChatGrade(data: typeof simulationChatGrades.$inferInsert) {
  try {
    const result = await db.insert(simulationChatGrades).values(data).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.create.failed", {
      message: "Error creating simulationChatGrade",
      subject: { entityType: "simulation_chat_grades" },
      context: { function: "_createSimulationChatGrade", file: "utils/mutations/simulation_chat_grades/create-simulation-chat-grade.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createSimulationChatGrade = createMockableAction('createSimulationChatGrade', _createSimulationChatGrade);
