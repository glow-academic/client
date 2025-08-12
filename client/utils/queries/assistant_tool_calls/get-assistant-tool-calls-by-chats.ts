// utils/queries/assistant_tool_calls/get-assistant-tool-calls-by-chats.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantToolCalls } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAssistantToolCallsByChats(chatIds: string[]) {
  try {
    return await db.select().from(assistantToolCalls).where(inArray(assistantToolCalls.chatId, chatIds));
  } catch (error) {
    await log.error("query.fetch_by_fk_plural.failed", {
      message: "Error fetching assistant_tool_calls by chats",
      subject: { entityType: "assistant_tool_calls" },
      context: { function: "_getAssistantToolCallsByChats", file: "utils/queries/assistant_tool_calls/get-assistant-tool-calls-by-chats.ts", foreignKey: "chatId", foreignIdsCount: chatIds.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAssistantToolCallsByChats = createMockableAction('getAssistantToolCallsByChats', _getAssistantToolCallsByChats);
