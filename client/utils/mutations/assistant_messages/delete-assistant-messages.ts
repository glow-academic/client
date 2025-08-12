// utils/mutations/assistant_messages/delete-assistant-messages.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantMessages } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteAssistantMessages(ids: string[]) {
  try {
    return await db.delete(assistantMessages).where(inArray(assistantMessages.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.delete_many.failed", {
      message: "Error deleting multiple assistant_messages",
      subject: { entityType: "assistant_messages" },
      context: { function: "_deleteAssistantMessages", file: "utils/mutations/assistant_messages/delete-assistant-messages.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteAssistantMessages = createMockableAction('deleteAssistantMessages', _deleteAssistantMessages);
