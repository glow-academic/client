// utils/mutations/simulation_attempts/delete-simulation-attempt.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationAttempts } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteSimulationAttempt(id: string) {
  try {
    const result = await db.delete(simulationAttempts).where(eq(simulationAttempts.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting simulationAttempt:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteSimulationAttempt = createMockableAction('deleteSimulationAttempt', _deleteSimulationAttempt);
