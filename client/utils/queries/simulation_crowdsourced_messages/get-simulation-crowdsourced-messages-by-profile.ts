// utils/queries/simulation_crowdsourced_messages/get-simulation-crowdsourced-messages-by-profile.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationCrowdsourcedMessages } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationCrowdsourcedMessagesByProfile(profileId: string) {
  try {
    return await db.select().from(simulationCrowdsourcedMessages).where(eq(simulationCrowdsourcedMessages.profileId, profileId));
  } catch (error) {
    await log.error("query.fetch_by_fk.failed", {
      message: "Error fetching simulation_crowdsourced_messages by profile",
      subject: { entityType: "simulation_crowdsourced_messages" },
      context: { function: "_getSimulationCrowdsourcedMessagesByProfile", file: "utils/queries/simulation_crowdsourced_messages/get-simulation-crowdsourced-messages-by-profile.ts", foreignKey: "profileId", foreignId: String(profileId) },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationCrowdsourcedMessagesByProfile = createMockableAction('getSimulationCrowdsourcedMessagesByProfile', _getSimulationCrowdsourcedMessagesByProfile);
