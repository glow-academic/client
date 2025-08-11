// utils/mutations/assistant_messages/create-assistant-message.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantMessages } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createAssistantMessage(data: typeof assistantMessages.$inferInsert) {
  try {
    const result = await db.insert(assistantMessages).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating assistantMessage:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const createAssistantMessage = createMockableAction('createAssistantMessage', _createAssistantMessage);
