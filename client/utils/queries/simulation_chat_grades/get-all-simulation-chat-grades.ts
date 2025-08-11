// utils/queries/simulation_chat_grades/get-all-simulation-chat-grades.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatGrades } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllSimulationChatGrades() {
  try {
    return await db.select().from(simulationChatGrades);
  } catch (error) {
    logError("Error fetching all simulation_chat_grades:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllSimulationChatGrades = createMockableAction('getAllSimulationChatGrades', _getAllSimulationChatGrades);
