// utils/mutations/assistant_messages/create-assistant-messages.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantMessages } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createAssistantMessages(data: (typeof assistantMessages.$inferInsert)[]) {
  try {
    return await db.insert(assistantMessages).values(data).returning();
  } catch (error) {
    logError("Error creating multiple assistant_messages:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const createAssistantMessages = createMockableAction('createAssistantMessages', _createAssistantMessages);
