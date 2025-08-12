// utils/mutations/assistant_tool_calls/create-assistant-tool-calls.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantToolCalls } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createAssistantToolCalls(data: (typeof assistantToolCalls.$inferInsert)[]) {
  try {
    return await db.insert(assistantToolCalls).values(data).returning();
  } catch (error) {
    await log.error("mutation.create_many.failed", {
      message: "Error creating multiple assistant_tool_calls",
      subject: { entityType: "assistant_tool_calls" },
      context: { function: "_createAssistantToolCalls", file: "utils/mutations/assistant_tool_calls/create-assistant-tool-calls.ts", count: Array.isArray(data) ? data.length : undefined },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createAssistantToolCalls = createMockableAction('createAssistantToolCalls', _createAssistantToolCalls);
