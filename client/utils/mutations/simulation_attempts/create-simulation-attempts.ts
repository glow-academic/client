// utils/mutations/simulation_attempts/create-simulation-attempts.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationAttempts } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createSimulationAttempts(data: (typeof simulationAttempts.$inferInsert)[]) {
  try {
    return await db.insert(simulationAttempts).values(data).returning();
  } catch (error) {
    await log.error("mutation.create_many.failed", {
      message: "Error creating multiple simulation_attempts",
      subject: { entityType: "simulation_attempts" },
      context: { function: "_createSimulationAttempts", file: "utils/mutations/simulation_attempts/create-simulation-attempts.ts", count: Array.isArray(data) ? data.length : undefined },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createSimulationAttempts = createMockableAction('createSimulationAttempts', _createSimulationAttempts);
