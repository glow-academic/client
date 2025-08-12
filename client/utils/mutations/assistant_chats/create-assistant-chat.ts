// utils/mutations/assistant_chats/create-assistant-chat.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantChats } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createAssistantChat(data: typeof assistantChats.$inferInsert) {
  try {
    const result = await db.insert(assistantChats).values(data).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.create.failed", {
      message: "Error creating assistantChat",
      subject: { entityType: "assistant_chats" },
      context: { function: "_createAssistantChat", file: "utils/mutations/assistant_chats/create-assistant-chat.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createAssistantChat = createMockableAction('createAssistantChat', _createAssistantChat);
