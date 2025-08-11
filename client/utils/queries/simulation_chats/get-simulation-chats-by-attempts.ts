// utils/queries/simulation_chats/get-simulation-chats-by-attempts.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChats } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationChatsByAttempts(attemptIds: string[]) {
  try {
    return await db.select().from(simulationChats).where(inArray(simulationChats.attemptId, attemptIds));
  } catch (error) {
    logError("Error fetching simulation_chats by attempts:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationChatsByAttempts = createMockableAction('getSimulationChatsByAttempts', _getSimulationChatsByAttempts);
