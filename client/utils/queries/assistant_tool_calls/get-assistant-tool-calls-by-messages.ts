// utils/queries/assistant_tool_calls/get-assistant-tool-calls-by-messages.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantToolCalls } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getAssistantToolCallsByMessages(messageIds: string[]) {
  try {
    return await db.select().from(assistantToolCalls).where(inArray(assistantToolCalls.messageId, messageIds));
  } catch (error) {
    logError("Error fetching assistant_tool_calls by messages:", error);
    throw error;
  }
}
