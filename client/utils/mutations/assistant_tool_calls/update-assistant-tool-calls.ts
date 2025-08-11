// utils/mutations/assistant_tool_calls/update-assistant-tool-calls.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantToolCalls } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateAssistantToolCalls(ids: string[], data: Partial<typeof assistantToolCalls.$inferInsert>) {
  try {
    return await db.update(assistantToolCalls).set(data).where(inArray(assistantToolCalls.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple assistant_tool_calls:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateAssistantToolCalls = createMockableAction('updateAssistantToolCalls', _updateAssistantToolCalls);
