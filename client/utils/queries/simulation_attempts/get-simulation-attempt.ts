// utils/queries/simulation_attempts/get-simulation-attempt.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationAttempts } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationAttempt(id: string) {
  try {
    const result = await db.select().from(simulationAttempts).where(eq(simulationAttempts.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching simulationAttempt:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationAttempt = createMockableAction('getSimulationAttempt', _getSimulationAttempt);
