// utils/queries/simulation_attempts/get-all-simulation-attempts.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationAttempts } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllSimulationAttempts() {
  try {
    return await db.select().from(simulationAttempts);
  } catch (error) {
    logError("Error fetching all simulation_attempts:", error);
    throw error;
  }
}
