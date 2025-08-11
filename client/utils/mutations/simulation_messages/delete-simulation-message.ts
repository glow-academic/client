// utils/mutations/simulation_messages/delete-simulation-message.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationMessages } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteSimulationMessage(id: string) {
  try {
    const result = await db.delete(simulationMessages).where(eq(simulationMessages.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting simulationMessage:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteSimulationMessage = createMockableAction('deleteSimulationMessage', _deleteSimulationMessage);
