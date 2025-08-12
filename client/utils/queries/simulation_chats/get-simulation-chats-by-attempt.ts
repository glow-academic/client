// utils/queries/simulation_chats/get-simulation-chats-by-attempt.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChats } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationChatsByAttempt(attemptId: string) {
  try {
    return await db.select().from(simulationChats).where(eq(simulationChats.attemptId, attemptId));
  } catch (error) {
    await log.error("query.fetch_by_fk.failed", {
      message: "Error fetching simulation_chats by attempt",
      subject: { entityType: "simulation_chats" },
      context: { function: "_getSimulationChatsByAttempt", file: "utils/queries/simulation_chats/get-simulation-chats-by-attempt.ts", foreignKey: "attemptId", foreignId: String(attemptId) },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationChatsByAttempt = createMockableAction('getSimulationChatsByAttempt', _getSimulationChatsByAttempt);
