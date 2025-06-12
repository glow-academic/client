// utils/queries/simulation_attempts/get-simulation-attempts-by-profile.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationAttempts } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getSimulationAttemptsByProfile(profileId: string) {
  try {
    return await db.select().from(simulationAttempts).where(eq(simulationAttempts.profileId, profileId));
  } catch (error) {
    console.error("Error fetching simulation_attempts by profile:", error);
    throw error;
  }
}
