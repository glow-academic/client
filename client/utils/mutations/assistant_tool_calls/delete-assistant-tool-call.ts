// utils/mutations/assistant_tool_calls/delete-assistant-tool-call.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantToolCalls } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteAssistantToolCall(id: string) {
  try {
    const result = await db.delete(assistantToolCalls).where(eq(assistantToolCalls.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting assistantToolCall:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteAssistantToolCall = createMockableAction('deleteAssistantToolCall', _deleteAssistantToolCall);
