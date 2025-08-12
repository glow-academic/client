// utils/mutations/simulation_messages/update-simulation-messages.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationMessages } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateSimulationMessages(ids: string[], data: Partial<typeof simulationMessages.$inferInsert>) {
  try {
    return await db.update(simulationMessages).set(data).where(inArray(simulationMessages.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.update_many.failed", {
      message: "Error updating multiple simulation_messages",
      subject: { entityType: "simulation_messages" },
      context: { function: "_updateSimulationMessages", file: "utils/mutations/simulation_messages/update-simulation-messages.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateSimulationMessages = createMockableAction('updateSimulationMessages', _updateSimulationMessages);
