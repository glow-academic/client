// utils/mutations/simulation_attempts/delete-simulation-attempts.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationAttempts } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteSimulationAttempts(ids: string[]) {
  try {
    return await db
      .delete(simulationAttempts)
      .where(inArray(simulationAttempts.id, ids))
      .returning();
  } catch (error) {
    console.error("Error deleting multiple simulation_attempts:", error);
    throw error;
  }
}
