// utils/mutations/assistant_messages/update-assistant-messages.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantMessages } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateAssistantMessages(ids: string[], data: Partial<typeof assistantMessages.$inferInsert>) {
  try {
    return await db.update(assistantMessages).set(data).where(inArray(assistantMessages.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple assistant_messages:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateAssistantMessages = createMockableAction('updateAssistantMessages', _updateAssistantMessages);
