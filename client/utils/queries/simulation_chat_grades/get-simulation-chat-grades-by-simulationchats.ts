// utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulation-chats.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatGrades } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationChatGradesBySimulationChats(simulationChatIds: string[]) {
  try {
    return await db.select().from(simulationChatGrades).where(inArray(simulationChatGrades.simulationChatId, simulationChatIds));
  } catch (error) {
    logError("Error fetching simulation_chat_grades by simulationChats:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationChatGradesBySimulationChats = createMockableAction('getSimulationChatGradesBySimulationChats', _getSimulationChatGradesBySimulationChats);
