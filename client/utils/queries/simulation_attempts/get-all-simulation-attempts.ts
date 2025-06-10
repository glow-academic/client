// utils/queries/simulation_attempts/get-all-simulation-attempts.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationAttempts } from "@/drizzle/schema";

export async function getAllSimulationAttempts() {
  try {
    return await db.select().from(simulationAttempts);
  } catch (error) {
    console.error("Error fetching all simulation_attempts:", error);
    throw error;
  }
}
