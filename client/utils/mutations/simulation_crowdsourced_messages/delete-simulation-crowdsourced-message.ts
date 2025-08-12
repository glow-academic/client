// utils/mutations/simulation_crowdsourced_messages/delete-simulation-crowdsourced-message.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationCrowdsourcedMessages } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteSimulationCrowdsourcedMessage(id: string) {
  try {
    const result = await db.delete(simulationCrowdsourcedMessages).where(eq(simulationCrowdsourcedMessages.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.delete.failed", {
      message: "Error deleting simulationCrowdsourcedMessage",
      subject: { entityType: "simulation_crowdsourced_messages", entityId: String(id) },
      context: { function: "_deleteSimulationCrowdsourcedMessage", file: "utils/mutations/simulation_crowdsourced_messages/delete-simulation-crowdsourced-message.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteSimulationCrowdsourcedMessage = createMockableAction('deleteSimulationCrowdsourcedMessage', _deleteSimulationCrowdsourcedMessage);
