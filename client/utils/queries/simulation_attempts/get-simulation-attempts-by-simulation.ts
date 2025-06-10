// utils/queries/simulation_attempts/get-simulation-attempts-by-simulation.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationAttempts } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSimulationAttemptsBySimulation(simulationId: string) {
  try {
    return await db
      .select()
      .from(simulationAttempts)
      .where(eq(simulationAttempts.simulationId, simulationId));
  } catch (error) {
    console.error("Error fetching simulation_attempts by simulation:", error);
    throw error;
  }
}
