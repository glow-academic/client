// utils/mutations/assistant_chats/create-assistant-chats.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantChats } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createAssistantChats(data: (typeof assistantChats.$inferInsert)[]) {
  try {
    return await db.insert(assistantChats).values(data).returning();
  } catch (error) {
    logError("Error creating multiple assistant_chats:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const createAssistantChats = createMockableAction('createAssistantChats', _createAssistantChats);
