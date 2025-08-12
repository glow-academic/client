// utils/mutations/simulation_chat_grades/update-simulation-chat-grades.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatGrades } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateSimulationChatGrades(ids: string[], data: Partial<typeof simulationChatGrades.$inferInsert>) {
  try {
    return await db.update(simulationChatGrades).set(data).where(inArray(simulationChatGrades.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.update_many.failed", {
      message: "Error updating multiple simulation_chat_grades",
      subject: { entityType: "simulation_chat_grades" },
      context: { function: "_updateSimulationChatGrades", file: "utils/mutations/simulation_chat_grades/update-simulation-chat-grades.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateSimulationChatGrades = createMockableAction('updateSimulationChatGrades', _updateSimulationChatGrades);
