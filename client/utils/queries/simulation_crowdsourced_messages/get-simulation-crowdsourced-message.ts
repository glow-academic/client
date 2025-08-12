// utils/queries/simulation_crowdsourced_messages/get-simulation-crowdsourced-message.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationCrowdsourcedMessages } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationCrowdsourcedMessage(id: string) {
  try {
    const result = await db.select().from(simulationCrowdsourcedMessages).where(eq(simulationCrowdsourcedMessages.id, id));
    return result[0] || null;
  } catch (error) {
    await log.error("query.fetch_one.failed", {
      message: "Error fetching simulationCrowdsourcedMessage",
      subject: { entityType: "simulation_crowdsourced_messages", entityId: String(id) },
      context: { function: "_getSimulationCrowdsourcedMessage", file: "utils/queries/simulation_crowdsourced_messages/get-simulation-crowdsourced-message.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationCrowdsourcedMessage = createMockableAction('getSimulationCrowdsourcedMessage', _getSimulationCrowdsourcedMessage);
