// utils/mutations/simulation_attempts/update-simulation-attempts.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationAttempts } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateSimulationAttempts(ids: string[], data: Partial<typeof simulationAttempts.$inferInsert>) {
  try {
    return await db.update(simulationAttempts).set(data).where(inArray(simulationAttempts.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.update_many.failed", {
      message: "Error updating multiple simulation_attempts",
      subject: { entityType: "simulation_attempts" },
      context: { function: "_updateSimulationAttempts", file: "utils/mutations/simulation_attempts/update-simulation-attempts.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateSimulationAttempts = createMockableAction('updateSimulationAttempts', _updateSimulationAttempts);
