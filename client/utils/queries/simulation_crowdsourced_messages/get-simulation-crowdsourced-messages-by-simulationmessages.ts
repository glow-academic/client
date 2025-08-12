// utils/queries/simulation_crowdsourced_messages/get-simulation-crowdsourced-messages-by-simulation-messages.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationCrowdsourcedMessages } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationCrowdsourcedMessagesBySimulationMessages(simulationMessageIds: string[]) {
  try {
    return await db.select().from(simulationCrowdsourcedMessages).where(inArray(simulationCrowdsourcedMessages.simulationMessageId, simulationMessageIds));
  } catch (error) {
    await log.error("query.fetch_by_fk_plural.failed", {
      message: "Error fetching simulation_crowdsourced_messages by simulationMessages",
      subject: { entityType: "simulation_crowdsourced_messages" },
      context: { function: "_getSimulationCrowdsourcedMessagesBySimulationMessages", file: "utils/queries/simulation_crowdsourced_messages/get-simulation-crowdsourced-messages-by-simulation-messages.ts", foreignKey: "simulationMessageId", foreignIdsCount: simulationMessageIds.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationCrowdsourcedMessagesBySimulationMessages = createMockableAction('getSimulationCrowdsourcedMessagesBySimulationMessages', _getSimulationCrowdsourcedMessagesBySimulationMessages);
