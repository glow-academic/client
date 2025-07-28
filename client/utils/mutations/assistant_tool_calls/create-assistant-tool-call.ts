// utils/mutations/assistant_tool_calls/create-assistant-tool-call.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantToolCalls } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createAssistantToolCall(data: typeof assistantToolCalls.$inferInsert) {
  try {
    const result = await db.insert(assistantToolCalls).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating assistantToolCall:", error);
    throw error;
  }
}
