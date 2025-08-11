// utils/queries/simulation_crowdsourced_messages/get-simulation-crowdsourced-messages-by-profile.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationCrowdsourcedMessages } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationCrowdsourcedMessagesByProfile(profileId: string) {
  try {
    return await db.select().from(simulationCrowdsourcedMessages).where(eq(simulationCrowdsourcedMessages.profileId, profileId));
  } catch (error) {
    logError("Error fetching simulation_crowdsourced_messages by profile:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationCrowdsourcedMessagesByProfile = createMockableAction('getSimulationCrowdsourcedMessagesByProfile', _getSimulationCrowdsourcedMessagesByProfile);
