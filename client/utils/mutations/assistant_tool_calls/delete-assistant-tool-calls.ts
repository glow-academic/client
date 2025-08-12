// utils/mutations/assistant_tool_calls/delete-assistant-tool-calls.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantToolCalls } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteAssistantToolCalls(ids: string[]) {
  try {
    return await db.delete(assistantToolCalls).where(inArray(assistantToolCalls.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.delete_many.failed", {
      message: "Error deleting multiple assistant_tool_calls",
      subject: { entityType: "assistant_tool_calls" },
      context: { function: "_deleteAssistantToolCalls", file: "utils/mutations/assistant_tool_calls/delete-assistant-tool-calls.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteAssistantToolCalls = createMockableAction('deleteAssistantToolCalls', _deleteAssistantToolCalls);
