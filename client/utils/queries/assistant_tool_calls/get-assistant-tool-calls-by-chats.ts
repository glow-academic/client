// utils/queries/assistant_tool_calls/get-assistant-tool-calls-by-chats.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantToolCalls } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getAssistantToolCallsByChats(chatIds: string[]) {
  try {
    return await db
      .select()
      .from(assistantToolCalls)
      .where(inArray(assistantToolCalls.chatId, chatIds));
  } catch (error) {
    logError("Error fetching assistant_tool_calls by chats:", error);
    throw error;
  }
}
