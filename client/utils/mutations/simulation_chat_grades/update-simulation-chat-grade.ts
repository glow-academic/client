// utils/mutations/simulation_chat_grades/update-simulation-chat-grade.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatGrades } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateSimulationChatGrade(id: string, data: Partial<typeof simulationChatGrades.$inferInsert>) {
  try {
    const result = await db.update(simulationChatGrades).set(data).where(eq(simulationChatGrades.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.update.failed", {
      message: "Error updating simulationChatGrade",
      subject: { entityType: "simulation_chat_grades", entityId: String(id) },
      context: { function: "_updateSimulationChatGrade", file: "utils/mutations/simulation_chat_grades/update-simulation-chat-grade.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateSimulationChatGrade = createMockableAction('updateSimulationChatGrade', _updateSimulationChatGrade);
