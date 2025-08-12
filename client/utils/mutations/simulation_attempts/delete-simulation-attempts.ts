// utils/mutations/simulation_attempts/delete-simulation-attempts.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationAttempts } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteSimulationAttempts(ids: string[]) {
  try {
    return await db.delete(simulationAttempts).where(inArray(simulationAttempts.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.delete_many.failed", {
      message: "Error deleting multiple simulation_attempts",
      subject: { entityType: "simulation_attempts" },
      context: { function: "_deleteSimulationAttempts", file: "utils/mutations/simulation_attempts/delete-simulation-attempts.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteSimulationAttempts = createMockableAction('deleteSimulationAttempts', _deleteSimulationAttempts);
