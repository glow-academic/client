// utils/mutations/assistant_chats/create-assistant-chats.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantChats } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createAssistantChats(data: (typeof assistantChats.$inferInsert)[]) {
  try {
    return await db.insert(assistantChats).values(data).returning();
  } catch (error) {
    await log.error("mutation.create_many.failed", {
      message: "Error creating multiple assistant_chats",
      subject: { entityType: "assistant_chats" },
      context: { function: "_createAssistantChats", file: "utils/mutations/assistant_chats/create-assistant-chats.ts", count: Array.isArray(data) ? data.length : undefined },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createAssistantChats = createMockableAction('createAssistantChats', _createAssistantChats);
