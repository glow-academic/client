// utils/mutations/simulation_chat_grades/create-simulation-chat-grades.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatGrades } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createSimulationChatGrades(data: (typeof simulationChatGrades.$inferInsert)[]) {
  try {
    return await db.insert(simulationChatGrades).values(data).returning();
  } catch (error) {
    await log.error("mutation.create_many.failed", {
      message: "Error creating multiple simulation_chat_grades",
      subject: { entityType: "simulation_chat_grades" },
      context: { function: "_createSimulationChatGrades", file: "utils/mutations/simulation_chat_grades/create-simulation-chat-grades.ts", count: Array.isArray(data) ? data.length : undefined },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createSimulationChatGrades = createMockableAction('createSimulationChatGrades', _createSimulationChatGrades);
