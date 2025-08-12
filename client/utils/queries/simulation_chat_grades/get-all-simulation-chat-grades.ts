// utils/queries/simulation_chat_grades/get-all-simulation-chat-grades.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChatGrades } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllSimulationChatGrades() {
  try {
    return await db.select().from(simulationChatGrades);
  } catch (error) {
    await log.error("query.fetch_all.failed", {
      message: "Error fetching all simulation_chat_grades",
      subject: { entityType: "simulation_chat_grades" },
      context: { function: "_getAllSimulationChatGrades", file: "utils/queries/simulation_chat_grades/get-all-simulation-chat-grades.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllSimulationChatGrades = createMockableAction('getAllSimulationChatGrades', _getAllSimulationChatGrades);
