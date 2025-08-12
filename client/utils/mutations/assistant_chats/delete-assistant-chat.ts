// utils/mutations/assistant_chats/delete-assistant-chat.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantChats } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteAssistantChat(id: string) {
  try {
    const result = await db.delete(assistantChats).where(eq(assistantChats.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.delete.failed", {
      message: "Error deleting assistantChat",
      subject: { entityType: "assistant_chats", entityId: String(id) },
      context: { function: "_deleteAssistantChat", file: "utils/mutations/assistant_chats/delete-assistant-chat.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteAssistantChat = createMockableAction('deleteAssistantChat', _deleteAssistantChat);
