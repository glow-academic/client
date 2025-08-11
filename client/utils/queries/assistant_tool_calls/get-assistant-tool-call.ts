// utils/queries/assistant_tool_calls/get-assistant-tool-call.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantToolCalls } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAssistantToolCall(id: string) {
  try {
    const result = await db.select().from(assistantToolCalls).where(eq(assistantToolCalls.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching assistantToolCall:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAssistantToolCall = createMockableAction('getAssistantToolCall', _getAssistantToolCall);
