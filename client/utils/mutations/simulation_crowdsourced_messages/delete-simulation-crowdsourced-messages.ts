// utils/mutations/simulation_crowdsourced_messages/delete-simulation-crowdsourced-messages.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationCrowdsourcedMessages } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteSimulationCrowdsourcedMessages(ids: string[]) {
  try {
    return await db.delete(simulationCrowdsourcedMessages).where(inArray(simulationCrowdsourcedMessages.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.delete_many.failed", {
      message: "Error deleting multiple simulation_crowdsourced_messages",
      subject: { entityType: "simulation_crowdsourced_messages" },
      context: { function: "_deleteSimulationCrowdsourcedMessages", file: "utils/mutations/simulation_crowdsourced_messages/delete-simulation-crowdsourced-messages.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteSimulationCrowdsourcedMessages = createMockableAction('deleteSimulationCrowdsourcedMessages', _deleteSimulationCrowdsourcedMessages);
