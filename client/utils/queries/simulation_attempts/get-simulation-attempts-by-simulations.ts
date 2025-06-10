// utils/queries/simulation_attempts/get-simulation-attempts-by-simulations.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationAttempts } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getSimulationAttemptsBySimulations(
  simulationIds: string[],
) {
  try {
    return await db
      .select()
      .from(simulationAttempts)
      .where(inArray(simulationAttempts.simulationId, simulationIds));
  } catch (error) {
    console.error("Error fetching simulation_attempts by simulations:", error);
    throw error;
  }
}
