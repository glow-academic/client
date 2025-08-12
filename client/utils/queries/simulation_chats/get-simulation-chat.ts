// utils/queries/simulation_chats/get-simulation-chat.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationChats } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationChat(id: string) {
  try {
    const result = await db.select().from(simulationChats).where(eq(simulationChats.id, id));
    return result[0] || null;
  } catch (error) {
    await log.error("query.fetch_one.failed", {
      message: "Error fetching simulationChat",
      subject: { entityType: "simulation_chats", entityId: String(id) },
      context: { function: "_getSimulationChat", file: "utils/queries/simulation_chats/get-simulation-chat.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationChat = createMockableAction('getSimulationChat', _getSimulationChat);
