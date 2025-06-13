// utils/mutations/simulation_attempts/delete-simulation-attempts.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationAttempts } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteSimulationAttempts(ids: string[]) {
  try {
    return await db.delete(simulationAttempts).where(inArray(simulationAttempts.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple simulation_attempts:", error);
    throw error;
  }
}
