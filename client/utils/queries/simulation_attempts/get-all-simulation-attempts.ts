// utils/queries/simulation_attempts/get-all-simulation-attempts.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationAttempts } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllSimulationAttempts() {
  try {
    return await db.select().from(simulationAttempts);
  } catch (error) {
    logError("Error fetching all simulation_attempts:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllSimulationAttempts = createMockableAction('getAllSimulationAttempts', _getAllSimulationAttempts);
