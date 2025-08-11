// utils/mutations/simulation_attempts/create-simulation-attempt.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationAttempts } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createSimulationAttempt(data: typeof simulationAttempts.$inferInsert) {
  try {
    const result = await db.insert(simulationAttempts).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating simulationAttempt:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const createSimulationAttempt = createMockableAction('createSimulationAttempt', _createSimulationAttempt);
