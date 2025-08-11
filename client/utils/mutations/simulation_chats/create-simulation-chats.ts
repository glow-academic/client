// utils/mutations/simulation_chats/create-simulation-chats.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChats } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createSimulationChats(data: (typeof simulationChats.$inferInsert)[]) {
  try {
    return await db.insert(simulationChats).values(data).returning();
  } catch (error) {
    logError("Error creating multiple simulation_chats:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const createSimulationChats = createMockableAction('createSimulationChats', _createSimulationChats);
