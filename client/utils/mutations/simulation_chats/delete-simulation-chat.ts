// utils/mutations/simulation_chats/delete-simulation-chat.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChats } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteSimulationChat(id: string) {
  try {
    const result = await db.delete(simulationChats).where(eq(simulationChats.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting simulationChat:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteSimulationChat = createMockableAction('deleteSimulationChat', _deleteSimulationChat);
