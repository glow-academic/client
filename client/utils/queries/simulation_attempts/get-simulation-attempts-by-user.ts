// utils/queries/simulation_attempts/get-simulation-attempts-by-user.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationAttempts } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSimulationAttemptsByUser(userId: string) {
  try {
    return await db.select().from(simulationAttempts).where(eq(simulationAttempts.userId, userId));
  } catch (error) {
    console.error("Error fetching simulation_attempts by user:", error);
    throw error;
  }
}
