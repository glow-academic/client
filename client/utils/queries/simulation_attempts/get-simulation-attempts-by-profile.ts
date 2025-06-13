// utils/queries/simulation_attempts/get-simulation-attempts-by-profile.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { simulationAttempts } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getSimulationAttemptsByProfile(profileId: string) {
  try {
    return await db.select().from(simulationAttempts).where(eq(simulationAttempts.profileId, profileId));
  } catch (error) {
    logError("Error fetching simulation_attempts by profile:", error);
    throw error;
  }
}
