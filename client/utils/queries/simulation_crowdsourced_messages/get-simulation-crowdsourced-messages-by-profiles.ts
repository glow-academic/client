// utils/queries/simulation_crowdsourced_messages/get-simulation-crowdsourced-messages-by-profiles.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationCrowdsourcedMessages } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationCrowdsourcedMessagesByProfiles(profileIds: string[]) {
  try {
    return await db.select().from(simulationCrowdsourcedMessages).where(inArray(simulationCrowdsourcedMessages.profileId, profileIds));
  } catch (error) {
    await log.error("query.fetch_by_fk_plural.failed", {
      message: "Error fetching simulation_crowdsourced_messages by profiles",
      subject: { entityType: "simulation_crowdsourced_messages" },
      context: { function: "_getSimulationCrowdsourcedMessagesByProfiles", file: "utils/queries/simulation_crowdsourced_messages/get-simulation-crowdsourced-messages-by-profiles.ts", foreignKey: "profileId", foreignIdsCount: profileIds.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationCrowdsourcedMessagesByProfiles = createMockableAction('getSimulationCrowdsourcedMessagesByProfiles', _getSimulationCrowdsourcedMessagesByProfiles);
