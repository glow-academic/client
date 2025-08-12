// utils/mutations/assistant_chats/delete-assistant-chats.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantChats } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteAssistantChats(ids: string[]) {
  try {
    return await db.delete(assistantChats).where(inArray(assistantChats.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.delete_many.failed", {
      message: "Error deleting multiple assistant_chats",
      subject: { entityType: "assistant_chats" },
      context: { function: "_deleteAssistantChats", file: "utils/mutations/assistant_chats/delete-assistant-chats.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteAssistantChats = createMockableAction('deleteAssistantChats', _deleteAssistantChats);
