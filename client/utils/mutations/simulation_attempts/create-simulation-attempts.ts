// utils/mutations/simulation_attempts/create-simulation-attempts.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationAttempts } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createSimulationAttempts(data: (typeof simulationAttempts.$inferInsert)[]) {
  try {
    return await db.insert(simulationAttempts).values(data).returning();
  } catch (error) {
    logError("Error creating multiple simulation_attempts:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const createSimulationAttempts = createMockableAction('createSimulationAttempts', _createSimulationAttempts);
