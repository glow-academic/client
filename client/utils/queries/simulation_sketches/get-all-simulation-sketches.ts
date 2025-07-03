// utils/queries/simulation_sketches/get-all-simulation-sketches.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationSketches } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllSimulationSketches() {
  try {
    return await db.select().from(simulationSketches);
  } catch (error) {
    logError("Error fetching all simulation_sketches:", error);
    throw error;
  }
}
