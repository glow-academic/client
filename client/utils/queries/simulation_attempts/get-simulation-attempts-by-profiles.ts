// utils/queries/simulation_attempts/get-simulation-attempts-by-profiles.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationAttempts } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationAttemptsByProfiles(profileIds: string[]) {
  try {
    return await db.select().from(simulationAttempts).where(inArray(simulationAttempts.profileId, profileIds));
  } catch (error) {
    await log.error("query.fetch_by_fk_plural.failed", {
      message: "Error fetching simulation_attempts by profiles",
      subject: { entityType: "simulation_attempts" },
      context: { function: "_getSimulationAttemptsByProfiles", file: "utils/queries/simulation_attempts/get-simulation-attempts-by-profiles.ts", foreignKey: "profileId", foreignIdsCount: profileIds.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationAttemptsByProfiles = createMockableAction('getSimulationAttemptsByProfiles', _getSimulationAttemptsByProfiles);
