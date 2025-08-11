// utils/mutations/simulation_chats/update-simulation-chats.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChats } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateSimulationChats(ids: string[], data: Partial<typeof simulationChats.$inferInsert>) {
  try {
    return await db.update(simulationChats).set(data).where(inArray(simulationChats.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple simulation_chats:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateSimulationChats = createMockableAction('updateSimulationChats', _updateSimulationChats);
