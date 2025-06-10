// utils/mutations/simulation_attempts/create-simulationAttempt.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationAttempts } from "@/drizzle/schema";

export async function createSimulationAttempt(data: typeof simulationAttempts.$inferInsert) {
  try {
    const result = await db.insert(simulationAttempts).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating simulationAttempt:", error);
    throw error;
  }
}
