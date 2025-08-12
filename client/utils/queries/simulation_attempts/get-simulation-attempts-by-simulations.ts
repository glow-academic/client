// utils/queries/simulation_attempts/get-simulation-attempts-by-simulations.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationAttempts } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationAttemptsBySimulations(simulationIds: string[]) {
  try {
    return await db.select().from(simulationAttempts).where(inArray(simulationAttempts.simulationId, simulationIds));
  } catch (error) {
    await log.error("query.fetch_by_fk_plural.failed", {
      message: "Error fetching simulation_attempts by simulations",
      subject: { entityType: "simulation_attempts" },
      context: { function: "_getSimulationAttemptsBySimulations", file: "utils/queries/simulation_attempts/get-simulation-attempts-by-simulations.ts", foreignKey: "simulationId", foreignIdsCount: simulationIds.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationAttemptsBySimulations = createMockableAction('getSimulationAttemptsBySimulations', _getSimulationAttemptsBySimulations);
