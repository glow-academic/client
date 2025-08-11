// utils/queries/simulation_attempts/get-simulation-attempts-by-profiles.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationAttempts } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationAttemptsByProfiles(profileIds: string[]) {
  try {
    return await db.select().from(simulationAttempts).where(inArray(simulationAttempts.profileId, profileIds));
  } catch (error) {
    logError("Error fetching simulation_attempts by profiles:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationAttemptsByProfiles = createMockableAction('getSimulationAttemptsByProfiles', _getSimulationAttemptsByProfiles);
