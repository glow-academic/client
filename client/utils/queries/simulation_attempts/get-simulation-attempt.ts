// utils/queries/simulation_attempts/get-simulation-attempt.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationAttempts } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSimulationAttempt(id: string) {
  try {
    const result = await db.select().from(simulationAttempts).where(eq(simulationAttempts.id, id));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching simulationAttempt:", error);
    throw error;
  }
}
