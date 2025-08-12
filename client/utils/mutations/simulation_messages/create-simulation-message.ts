// utils/mutations/simulation_messages/create-simulation-message.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationMessages } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createSimulationMessage(data: typeof simulationMessages.$inferInsert) {
  try {
    const result = await db.insert(simulationMessages).values(data).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.create.failed", {
      message: "Error creating simulationMessage",
      subject: { entityType: "simulation_messages" },
      context: { function: "_createSimulationMessage", file: "utils/mutations/simulation_messages/create-simulation-message.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createSimulationMessage = createMockableAction('createSimulationMessage', _createSimulationMessage);
