// utils/mutations/simulation_chat_grades/delete-simulation-chat-grade.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatGrades } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteSimulationChatGrade(id: string) {
  try {
    const result = await db.delete(simulationChatGrades).where(eq(simulationChatGrades.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.delete.failed", {
      message: "Error deleting simulationChatGrade",
      subject: { entityType: "simulation_chat_grades", entityId: String(id) },
      context: { function: "_deleteSimulationChatGrade", file: "utils/mutations/simulation_chat_grades/delete-simulation-chat-grade.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteSimulationChatGrade = createMockableAction('deleteSimulationChatGrade', _deleteSimulationChatGrade);
