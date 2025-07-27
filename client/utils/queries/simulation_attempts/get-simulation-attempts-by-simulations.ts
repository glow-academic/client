// utils/queries/simulation_attempts/get-simulation-attempts-by-simulations.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationAttempts } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getSimulationAttemptsBySimulations(
  simulationIds: string[],
) {
  try {
    return await db
      .select()
      .from(simulationAttempts)
      .where(inArray(simulationAttempts.simulationId, simulationIds));
  } catch (error) {
    logError("Error fetching simulation_attempts by simulations:", error);
    throw error;
  }
}
