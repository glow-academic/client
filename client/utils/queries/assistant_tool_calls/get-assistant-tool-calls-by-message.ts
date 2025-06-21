// utils/queries/assistant_tool_calls/get-assistant-tool-calls-by-message.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantToolCalls } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getAssistantToolCallsByMessage(messageId: string) {
  try {
    return await db.select().from(assistantToolCalls).where(eq(assistantToolCalls.messageId, messageId));
  } catch (error) {
    logError("Error fetching assistant_tool_calls by message:", error);
    throw error;
  }
}
