// utils/queries/simulation_messages/get-simulation-messages-by-chats.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationMessages } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationMessagesByChats(chatIds: string[]) {
  try {
    return await db.select().from(simulationMessages).where(inArray(simulationMessages.chatId, chatIds));
  } catch (error) {
    logError("Error fetching simulation_messages by chats:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationMessagesByChats = createMockableAction('getSimulationMessagesByChats', _getSimulationMessagesByChats);
