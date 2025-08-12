// utils/mutations/assistant_messages/delete-assistant-message.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantMessages } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteAssistantMessage(id: string) {
  try {
    const result = await db.delete(assistantMessages).where(eq(assistantMessages.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.delete.failed", {
      message: "Error deleting assistantMessage",
      subject: { entityType: "assistant_messages", entityId: String(id) },
      context: { function: "_deleteAssistantMessage", file: "utils/mutations/assistant_messages/delete-assistant-message.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteAssistantMessage = createMockableAction('deleteAssistantMessage', _deleteAssistantMessage);
