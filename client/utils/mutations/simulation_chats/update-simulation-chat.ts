// utils/mutations/simulation_chats/update-simulation-chat.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChats } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateSimulationChat(id: string, data: Partial<typeof simulationChats.$inferInsert>) {
  try {
    const result = await db.update(simulationChats).set(data).where(eq(simulationChats.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.update.failed", {
      message: "Error updating simulationChat",
      subject: { entityType: "simulation_chats", entityId: String(id) },
      context: { function: "_updateSimulationChat", file: "utils/mutations/simulation_chats/update-simulation-chat.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateSimulationChat = createMockableAction('updateSimulationChat', _updateSimulationChat);
