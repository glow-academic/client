// utils/mutations/simulation_attempts/delete-simulation-attempts.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationAttempts } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteSimulationAttempts(ids: string[]) {
  try {
    return await db.delete(simulationAttempts).where(inArray(simulationAttempts.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple simulation_attempts:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteSimulationAttempts = createMockableAction('deleteSimulationAttempts', _deleteSimulationAttempts);
