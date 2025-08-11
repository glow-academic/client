// utils/mutations/simulation_messages/create-simulation-messages.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationMessages } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createSimulationMessages(data: (typeof simulationMessages.$inferInsert)[]) {
  try {
    return await db.insert(simulationMessages).values(data).returning();
  } catch (error) {
    logError("Error creating multiple simulation_messages:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const createSimulationMessages = createMockableAction('createSimulationMessages', _createSimulationMessages);
