// utils/mutations/assistant_tool_calls/delete-assistant-tool-calls.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantToolCalls } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteAssistantToolCalls(ids: string[]) {
  try {
    return await db.delete(assistantToolCalls).where(inArray(assistantToolCalls.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple assistant_tool_calls:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteAssistantToolCalls = createMockableAction('deleteAssistantToolCalls', _deleteAssistantToolCalls);
