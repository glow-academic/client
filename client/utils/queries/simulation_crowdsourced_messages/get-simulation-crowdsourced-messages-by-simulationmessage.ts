// utils/queries/simulation_crowdsourced_messages/get-simulation-crowdsourced-messages-by-simulation-message.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationCrowdsourcedMessages } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationCrowdsourcedMessagesBySimulationMessage(simulationMessageId: string) {
  try {
    return await db.select().from(simulationCrowdsourcedMessages).where(eq(simulationCrowdsourcedMessages.simulationMessageId, simulationMessageId));
  } catch (error) {
    await log.error("query.fetch_by_fk.failed", {
      message: "Error fetching simulation_crowdsourced_messages by simulationMessage",
      subject: { entityType: "simulation_crowdsourced_messages" },
      context: { function: "_getSimulationCrowdsourcedMessagesBySimulationMessage", file: "utils/queries/simulation_crowdsourced_messages/get-simulation-crowdsourced-messages-by-simulation-message.ts", foreignKey: "simulationMessageId", foreignId: String(simulationMessageId) },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationCrowdsourcedMessagesBySimulationMessage = createMockableAction('getSimulationCrowdsourcedMessagesBySimulationMessage', _getSimulationCrowdsourcedMessagesBySimulationMessage);
