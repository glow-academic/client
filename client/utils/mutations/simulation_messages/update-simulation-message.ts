// utils/mutations/simulation_messages/update-simulation-message.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationMessages } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateSimulationMessage(id: string, data: Partial<typeof simulationMessages.$inferInsert>) {
  try {
    const result = await db.update(simulationMessages).set(data).where(eq(simulationMessages.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating simulationMessage:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateSimulationMessage = createMockableAction('updateSimulationMessage', _updateSimulationMessage);
