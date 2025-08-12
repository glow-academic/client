// utils/mutations/simulation_chats/create-simulation-chat.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChats } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createSimulationChat(data: typeof simulationChats.$inferInsert) {
  try {
    const result = await db.insert(simulationChats).values(data).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.create.failed", {
      message: "Error creating simulationChat",
      subject: { entityType: "simulation_chats" },
      context: { function: "_createSimulationChat", file: "utils/mutations/simulation_chats/create-simulation-chat.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createSimulationChat = createMockableAction('createSimulationChat', _createSimulationChat);
