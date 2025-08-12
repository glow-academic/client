// utils/queries/assistant_messages/get-assistant-messages-by-chats.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantMessages } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAssistantMessagesByChats(chatIds: string[]) {
  try {
    return await db.select().from(assistantMessages).where(inArray(assistantMessages.chatId, chatIds));
  } catch (error) {
    await log.error("query.fetch_by_fk_plural.failed", {
      message: "Error fetching assistant_messages by chats",
      subject: { entityType: "assistant_messages" },
      context: { function: "_getAssistantMessagesByChats", file: "utils/queries/assistant_messages/get-assistant-messages-by-chats.ts", foreignKey: "chatId", foreignIdsCount: chatIds.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAssistantMessagesByChats = createMockableAction('getAssistantMessagesByChats', _getAssistantMessagesByChats);
