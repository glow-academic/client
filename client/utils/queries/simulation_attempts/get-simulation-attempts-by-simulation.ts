// utils/queries/simulation_attempts/get-simulation-attempts-by-simulation.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationAttempts } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationAttemptsBySimulation(simulationId: string) {
  try {
    return await db.select().from(simulationAttempts).where(eq(simulationAttempts.simulationId, simulationId));
  } catch (error) {
    await log.error("query.fetch_by_fk.failed", {
      message: "Error fetching simulation_attempts by simulation",
      subject: { entityType: "simulation_attempts" },
      context: { function: "_getSimulationAttemptsBySimulation", file: "utils/queries/simulation_attempts/get-simulation-attempts-by-simulation.ts", foreignKey: "simulationId", foreignId: String(simulationId) },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationAttemptsBySimulation = createMockableAction('getSimulationAttemptsBySimulation', _getSimulationAttemptsBySimulation);
