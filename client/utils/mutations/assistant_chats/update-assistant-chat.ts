// utils/mutations/assistant_chats/update-assistant-chat.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantChats } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateAssistantChat(id: string, data: Partial<typeof assistantChats.$inferInsert>) {
  try {
    const result = await db.update(assistantChats).set(data).where(eq(assistantChats.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.update.failed", {
      message: "Error updating assistantChat",
      subject: { entityType: "assistant_chats", entityId: String(id) },
      context: { function: "_updateAssistantChat", file: "utils/mutations/assistant_chats/update-assistant-chat.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateAssistantChat = createMockableAction('updateAssistantChat', _updateAssistantChat);
