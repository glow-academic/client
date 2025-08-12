// utils/mutations/simulation_crowdsourced_messages/create-simulation-crowdsourced-messages.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationCrowdsourcedMessages } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createSimulationCrowdsourcedMessages(data: (typeof simulationCrowdsourcedMessages.$inferInsert)[]) {
  try {
    return await db.insert(simulationCrowdsourcedMessages).values(data).returning();
  } catch (error) {
    await log.error("mutation.create_many.failed", {
      message: "Error creating multiple simulation_crowdsourced_messages",
      subject: { entityType: "simulation_crowdsourced_messages" },
      context: { function: "_createSimulationCrowdsourcedMessages", file: "utils/mutations/simulation_crowdsourced_messages/create-simulation-crowdsourced-messages.ts", count: Array.isArray(data) ? data.length : undefined },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createSimulationCrowdsourcedMessages = createMockableAction('createSimulationCrowdsourcedMessages', _createSimulationCrowdsourcedMessages);
