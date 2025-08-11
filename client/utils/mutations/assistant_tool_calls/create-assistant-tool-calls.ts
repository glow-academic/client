// utils/mutations/assistant_tool_calls/create-assistant-tool-calls.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantToolCalls } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createAssistantToolCalls(data: (typeof assistantToolCalls.$inferInsert)[]) {
  try {
    return await db.insert(assistantToolCalls).values(data).returning();
  } catch (error) {
    logError("Error creating multiple assistant_tool_calls:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const createAssistantToolCalls = createMockableAction('createAssistantToolCalls', _createAssistantToolCalls);
