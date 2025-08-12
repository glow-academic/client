// utils/queries/simulation_attempts/get-simulation-attempt.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationAttempts } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationAttempt(id: string) {
  try {
    const result = await db.select().from(simulationAttempts).where(eq(simulationAttempts.id, id));
    return result[0] || null;
  } catch (error) {
    await log.error("query.fetch_one.failed", {
      message: "Error fetching simulationAttempt",
      subject: { entityType: "simulation_attempts", entityId: String(id) },
      context: { function: "_getSimulationAttempt", file: "utils/queries/simulation_attempts/get-simulation-attempt.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationAttempt = createMockableAction('getSimulationAttempt', _getSimulationAttempt);
