// utils/queries/assistant_chats/get-assistant-chat.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantChats } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAssistantChat(id: string) {
  try {
    const result = await db.select().from(assistantChats).where(eq(assistantChats.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching assistantChat:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAssistantChat = createMockableAction('getAssistantChat', _getAssistantChat);
