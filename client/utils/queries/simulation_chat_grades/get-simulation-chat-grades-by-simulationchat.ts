// utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulation-chat.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatGrades } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationChatGradesBySimulationChat(simulationChatId: string) {
  try {
    return await db.select().from(simulationChatGrades).where(eq(simulationChatGrades.simulationChatId, simulationChatId));
  } catch (error) {
    await log.error("query.fetch_by_fk.failed", {
      message: "Error fetching simulation_chat_grades by simulationChat",
      subject: { entityType: "simulation_chat_grades" },
      context: { function: "_getSimulationChatGradesBySimulationChat", file: "utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulation-chat.ts", foreignKey: "simulationChatId", foreignId: String(simulationChatId) },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationChatGradesBySimulationChat = createMockableAction('getSimulationChatGradesBySimulationChat', _getSimulationChatGradesBySimulationChat);
