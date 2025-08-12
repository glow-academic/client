// utils/queries/simulation_attempts/get-simulation-attempts-by-profile.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationAttempts } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationAttemptsByProfile(profileId: string) {
  try {
    return await db.select().from(simulationAttempts).where(eq(simulationAttempts.profileId, profileId));
  } catch (error) {
    await log.error("query.fetch_by_fk.failed", {
      message: "Error fetching simulation_attempts by profile",
      subject: { entityType: "simulation_attempts" },
      context: { function: "_getSimulationAttemptsByProfile", file: "utils/queries/simulation_attempts/get-simulation-attempts-by-profile.ts", foreignKey: "profileId", foreignId: String(profileId) },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationAttemptsByProfile = createMockableAction('getSimulationAttemptsByProfile', _getSimulationAttemptsByProfile);
