// utils/queries/simulation_crowdsourced_messages/get-all-simulation-crowdsourced-messages.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationCrowdsourcedMessages } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllSimulationCrowdsourcedMessages() {
  try {
    return await db.select().from(simulationCrowdsourcedMessages);
  } catch (error) {
    logError("Error fetching all simulation_crowdsourced_messages:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllSimulationCrowdsourcedMessages = createMockableAction('getAllSimulationCrowdsourcedMessages', _getAllSimulationCrowdsourcedMessages);
