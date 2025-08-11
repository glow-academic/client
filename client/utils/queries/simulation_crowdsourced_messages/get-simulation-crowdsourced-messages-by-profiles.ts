// utils/queries/simulation_crowdsourced_messages/get-simulation-crowdsourced-messages-by-profiles.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationCrowdsourcedMessages } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationCrowdsourcedMessagesByProfiles(profileIds: string[]) {
  try {
    return await db.select().from(simulationCrowdsourcedMessages).where(inArray(simulationCrowdsourcedMessages.profileId, profileIds));
  } catch (error) {
    logError("Error fetching simulation_crowdsourced_messages by profiles:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationCrowdsourcedMessagesByProfiles = createMockableAction('getSimulationCrowdsourcedMessagesByProfiles', _getSimulationCrowdsourcedMessagesByProfiles);
