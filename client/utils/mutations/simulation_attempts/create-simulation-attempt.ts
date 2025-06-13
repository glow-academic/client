// utils/mutations/simulation_attempts/create-simulation-attempt.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationAttempts } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createSimulationAttempt(data: typeof simulationAttempts.$inferInsert) {
  try {
    const result = await db.insert(simulationAttempts).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating simulationAttempt:", error);
    throw error;
  }
}
