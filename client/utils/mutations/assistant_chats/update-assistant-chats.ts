// utils/mutations/assistant_chats/update-assistant-chats.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantChats } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateAssistantChats(ids: string[], data: Partial<typeof assistantChats.$inferInsert>) {
  try {
    return await db.update(assistantChats).set(data).where(inArray(assistantChats.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple assistant_chats:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateAssistantChats = createMockableAction('updateAssistantChats', _updateAssistantChats);
