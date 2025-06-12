// utils/queries/simulation_attempts/get-simulation-attempts-by-profiles.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationAttempts } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getSimulationAttemptsByProfiles(profileIds: string[]) {
  try {
    return await db.select().from(simulationAttempts).where(inArray(simulationAttempts.profileId, profileIds));
  } catch (error) {
    console.error("Error fetching simulation_attempts by profiles:", error);
    throw error;
  }
}
