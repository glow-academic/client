// utils/mutations/simulation_attempts/create-simulation-attempts.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationAttempts } from "@/drizzle/schema";

export async function createSimulationAttempts(data: (typeof simulationAttempts.$inferInsert)[]) {
  try {
    return await db.insert(simulationAttempts).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple simulation_attempts:", error);
    throw error;
  }
}
