// utils/mutations/simulation_chats/delete-simulation-chat.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChats } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteSimulationChat(id: string) {
  try {
    const result = await db.delete(simulationChats).where(eq(simulationChats.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.delete.failed", {
      message: "Error deleting simulationChat",
      subject: { entityType: "simulation_chats", entityId: String(id) },
      context: { function: "_deleteSimulationChat", file: "utils/mutations/simulation_chats/delete-simulation-chat.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteSimulationChat = createMockableAction('deleteSimulationChat', _deleteSimulationChat);
