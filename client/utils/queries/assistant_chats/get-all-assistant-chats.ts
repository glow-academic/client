// utils/queries/assistant_chats/get-all-assistant-chats.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantChats } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllAssistantChats() {
  try {
    return await db.select().from(assistantChats);
  } catch (error) {
    await log.error("query.fetch_all.failed", {
      message: "Error fetching all assistant_chats",
      subject: { entityType: "assistant_chats" },
      context: { function: "_getAllAssistantChats", file: "utils/queries/assistant_chats/get-all-assistant-chats.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllAssistantChats = createMockableAction('getAllAssistantChats', _getAllAssistantChats);
