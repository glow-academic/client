// utils/queries/simulation_attempts/get-simulation-attempt.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationAttempts } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getSimulationAttempt(id: string) {
  try {
    const result = await db.select().from(simulationAttempts).where(eq(simulationAttempts.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching simulationAttempt:", error);
    throw error;
  }
}
