// utils/queries/assistant_tool_calls/get-assistant-tool-calls-by-chat.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantToolCalls } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAssistantToolCallsByChat(chatId: string) {
  try {
    return await db.select().from(assistantToolCalls).where(eq(assistantToolCalls.chatId, chatId));
  } catch (error) {
    logError("Error fetching assistant_tool_calls by chat:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAssistantToolCallsByChat = createMockableAction('getAssistantToolCallsByChat', _getAssistantToolCallsByChat);
