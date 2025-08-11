// utils/queries/assistant_chats/get-all-assistant-chats.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantChats } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllAssistantChats() {
  try {
    return await db.select().from(assistantChats);
  } catch (error) {
    logError("Error fetching all assistant_chats:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllAssistantChats = createMockableAction('getAllAssistantChats', _getAllAssistantChats);
