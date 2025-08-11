// utils/queries/simulation_crowdsourced_messages/get-simulation-crowdsourced-message.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationCrowdsourcedMessages } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationCrowdsourcedMessage(id: string) {
  try {
    const result = await db.select().from(simulationCrowdsourcedMessages).where(eq(simulationCrowdsourcedMessages.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching simulationCrowdsourcedMessage:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationCrowdsourcedMessage = createMockableAction('getSimulationCrowdsourcedMessage', _getSimulationCrowdsourcedMessage);
