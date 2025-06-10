// utils/queries/simulation_attempts/get-simulation-attempts-by-users.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationAttempts } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getSimulationAttemptsByUsers(userIds: string[]) {
  try {
    return await db.select().from(simulationAttempts).where(inArray(simulationAttempts.userId, userIds));
  } catch (error) {
    console.error("Error fetching simulation_attempts by users:", error);
    throw error;
  }
}
