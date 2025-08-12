// utils/mutations/simulation_crowdsourced_messages/update-simulation-crowdsourced-messages.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationCrowdsourcedMessages } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateSimulationCrowdsourcedMessages(ids: string[], data: Partial<typeof simulationCrowdsourcedMessages.$inferInsert>) {
  try {
    return await db.update(simulationCrowdsourcedMessages).set(data).where(inArray(simulationCrowdsourcedMessages.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.update_many.failed", {
      message: "Error updating multiple simulation_crowdsourced_messages",
      subject: { entityType: "simulation_crowdsourced_messages" },
      context: { function: "_updateSimulationCrowdsourcedMessages", file: "utils/mutations/simulation_crowdsourced_messages/update-simulation-crowdsourced-messages.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateSimulationCrowdsourcedMessages = createMockableAction('updateSimulationCrowdsourcedMessages', _updateSimulationCrowdsourcedMessages);
