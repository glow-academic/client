// utils/queries/simulation_crowdsourced_messages/get-simulation-crowdsourced-messages-by-simulation-message.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationCrowdsourcedMessages } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationCrowdsourcedMessagesBySimulationMessage(simulationMessageId: string) {
  try {
    return await db.select().from(simulationCrowdsourcedMessages).where(eq(simulationCrowdsourcedMessages.simulationMessageId, simulationMessageId));
  } catch (error) {
    logError("Error fetching simulation_crowdsourced_messages by simulationMessage:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationCrowdsourcedMessagesBySimulationMessage = createMockableAction('getSimulationCrowdsourcedMessagesBySimulationMessage', _getSimulationCrowdsourcedMessagesBySimulationMessage);
