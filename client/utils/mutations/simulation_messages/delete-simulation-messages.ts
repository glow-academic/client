// utils/mutations/simulation_messages/delete-simulation-messages.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationMessages } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteSimulationMessages(ids: string[]) {
  try {
    return await db.delete(simulationMessages).where(inArray(simulationMessages.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple simulation_messages:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteSimulationMessages = createMockableAction('deleteSimulationMessages', _deleteSimulationMessages);
