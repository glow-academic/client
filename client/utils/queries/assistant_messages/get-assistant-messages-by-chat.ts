// utils/queries/assistant_messages/get-assistant-messages-by-chat.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantMessages } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAssistantMessagesByChat(chatId: string) {
  try {
    return await db.select().from(assistantMessages).where(eq(assistantMessages.chatId, chatId));
  } catch (error) {
    logError("Error fetching assistant_messages by chat:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAssistantMessagesByChat = createMockableAction('getAssistantMessagesByChat', _getAssistantMessagesByChat);
