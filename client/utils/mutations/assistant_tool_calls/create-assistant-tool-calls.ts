// utils/mutations/assistant_tool_calls/create-assistant-tool-calls.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantToolCalls } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createAssistantToolCalls(
  data: (typeof assistantToolCalls.$inferInsert)[],
) {
  try {
    return await db.insert(assistantToolCalls).values(data).returning();
  } catch (error) {
    logError("Error creating multiple assistant_tool_calls:", error);
    throw error;
  }
}
