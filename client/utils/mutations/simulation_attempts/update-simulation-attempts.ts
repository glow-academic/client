// utils/mutations/simulation_attempts/update-simulation-attempts.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationAttempts } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateSimulationAttempts(
  ids: string[],
  data: Partial<typeof simulationAttempts.$inferInsert>,
) {
  try {
    return await db
      .update(simulationAttempts)
      .set(data)
      .where(inArray(simulationAttempts.id, ids))
      .returning();
  } catch (error) {
    logError("Error updating multiple simulation_attempts:", error);
    throw error;
  }
}
