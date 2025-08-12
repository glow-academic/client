// utils/mutations/assistant_messages/update-assistant-message.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantMessages } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateAssistantMessage(id: string, data: Partial<typeof assistantMessages.$inferInsert>) {
  try {
    const result = await db.update(assistantMessages).set(data).where(eq(assistantMessages.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.update.failed", {
      message: "Error updating assistantMessage",
      subject: { entityType: "assistant_messages", entityId: String(id) },
      context: { function: "_updateAssistantMessage", file: "utils/mutations/assistant_messages/update-assistant-message.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateAssistantMessage = createMockableAction('updateAssistantMessage', _updateAssistantMessage);
