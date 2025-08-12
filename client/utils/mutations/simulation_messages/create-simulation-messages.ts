// utils/mutations/simulation_messages/create-simulation-messages.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationMessages } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createSimulationMessages(data: (typeof simulationMessages.$inferInsert)[]) {
  try {
    return await db.insert(simulationMessages).values(data).returning();
  } catch (error) {
    await log.error("mutation.create_many.failed", {
      message: "Error creating multiple simulation_messages",
      subject: { entityType: "simulation_messages" },
      context: { function: "_createSimulationMessages", file: "utils/mutations/simulation_messages/create-simulation-messages.ts", count: Array.isArray(data) ? data.length : undefined },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createSimulationMessages = createMockableAction('createSimulationMessages', _createSimulationMessages);
