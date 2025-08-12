// utils/mutations/simulation_crowdsourced_messages/create-simulation-crowdsourced-message.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationCrowdsourcedMessages } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createSimulationCrowdsourcedMessage(data: typeof simulationCrowdsourcedMessages.$inferInsert) {
  try {
    const result = await db.insert(simulationCrowdsourcedMessages).values(data).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.create.failed", {
      message: "Error creating simulationCrowdsourcedMessage",
      subject: { entityType: "simulation_crowdsourced_messages" },
      context: { function: "_createSimulationCrowdsourcedMessage", file: "utils/mutations/simulation_crowdsourced_messages/create-simulation-crowdsourced-message.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createSimulationCrowdsourcedMessage = createMockableAction('createSimulationCrowdsourcedMessage', _createSimulationCrowdsourcedMessage);
