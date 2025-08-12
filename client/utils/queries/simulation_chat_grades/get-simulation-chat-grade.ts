// utils/queries/simulation_chat_grades/get-simulation-chat-grade.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatGrades } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationChatGrade(id: string) {
  try {
    const result = await db.select().from(simulationChatGrades).where(eq(simulationChatGrades.id, id));
    return result[0] || null;
  } catch (error) {
    await log.error("query.fetch_one.failed", {
      message: "Error fetching simulationChatGrade",
      subject: { entityType: "simulation_chat_grades", entityId: String(id) },
      context: { function: "_getSimulationChatGrade", file: "utils/queries/simulation_chat_grades/get-simulation-chat-grade.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationChatGrade = createMockableAction('getSimulationChatGrade', _getSimulationChatGrade);
