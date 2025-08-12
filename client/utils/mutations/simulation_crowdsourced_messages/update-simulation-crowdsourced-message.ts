// utils/mutations/simulation_crowdsourced_messages/update-simulation-crowdsourced-message.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationCrowdsourcedMessages } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateSimulationCrowdsourcedMessage(id: string, data: Partial<typeof simulationCrowdsourcedMessages.$inferInsert>) {
  try {
    const result = await db.update(simulationCrowdsourcedMessages).set(data).where(eq(simulationCrowdsourcedMessages.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.update.failed", {
      message: "Error updating simulationCrowdsourcedMessage",
      subject: { entityType: "simulation_crowdsourced_messages", entityId: String(id) },
      context: { function: "_updateSimulationCrowdsourcedMessage", file: "utils/mutations/simulation_crowdsourced_messages/update-simulation-crowdsourced-message.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateSimulationCrowdsourcedMessage = createMockableAction('updateSimulationCrowdsourcedMessage', _updateSimulationCrowdsourcedMessage);
