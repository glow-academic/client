// utils/queries/simulation_messages/get-simulation-messages-by-chat.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { simulationMessages } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getSimulationMessagesByChat(chatId: string) {
  try {
    return await db.select().from(simulationMessages).where(eq(simulationMessages.chatId, chatId));
  } catch (error) {
    logError("Error fetching simulation_messages by chat:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getSimulationMessagesByChat = createMockableAction('getSimulationMessagesByChat', _getSimulationMessagesByChat);
