// utils/queries/simulation_attempts/get-simulation-attempts-by-simulation.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationAttempts } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getSimulationAttemptsBySimulation(simulationId: string) {
  try {
    return await db.select().from(simulationAttempts).where(eq(simulationAttempts.simulationId, simulationId));
  } catch (error) {
    logError("Error fetching simulation_attempts by simulation:", error);
    throw error;
  }
}
