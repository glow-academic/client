// utils/mutations/simulation_attempts/delete-simulation-attempt.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationAttempts } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function deleteSimulationAttempt(id: string) {
  try {
    const result = await db.delete(simulationAttempts).where(eq(simulationAttempts.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error deleting simulationAttempt:", error);
    throw error;
  }
}
