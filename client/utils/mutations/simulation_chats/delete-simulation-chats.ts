// utils/mutations/simulation_chats/delete-simulation-chats.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChats } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteSimulationChats(ids: string[]) {
  try {
    return await db.delete(simulationChats).where(inArray(simulationChats.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple simulation_chats:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteSimulationChats = createMockableAction('deleteSimulationChats', _deleteSimulationChats);
