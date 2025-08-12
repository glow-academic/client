// utils/queries/simulation_chats/get-simulation-chats-by-attempts.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChats } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationChatsByAttempts(attemptIds: string[]) {
  try {
    return await db.select().from(simulationChats).where(inArray(simulationChats.attemptId, attemptIds));
  } catch (error) {
    await log.error("query.fetch_by_fk_plural.failed", {
      message: "Error fetching simulation_chats by attempts",
      subject: { entityType: "simulation_chats" },
      context: { function: "_getSimulationChatsByAttempts", file: "utils/queries/simulation_chats/get-simulation-chats-by-attempts.ts", foreignKey: "attemptId", foreignIdsCount: attemptIds.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationChatsByAttempts = createMockableAction('getSimulationChatsByAttempts', _getSimulationChatsByAttempts);
