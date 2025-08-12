// utils/mutations/simulation_attempts/update-simulation-attempt.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationAttempts } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateSimulationAttempt(id: string, data: Partial<typeof simulationAttempts.$inferInsert>) {
  try {
    const result = await db.update(simulationAttempts).set(data).where(eq(simulationAttempts.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.update.failed", {
      message: "Error updating simulationAttempt",
      subject: { entityType: "simulation_attempts", entityId: String(id) },
      context: { function: "_updateSimulationAttempt", file: "utils/mutations/simulation_attempts/update-simulation-attempt.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateSimulationAttempt = createMockableAction('updateSimulationAttempt', _updateSimulationAttempt);
