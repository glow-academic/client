// utils/mutations/assistant_tool_calls/create-assistant-tool-call.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantToolCalls } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createAssistantToolCall(data: typeof assistantToolCalls.$inferInsert) {
  try {
    const result = await db.insert(assistantToolCalls).values(data).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.create.failed", {
      message: "Error creating assistantToolCall",
      subject: { entityType: "assistant_tool_calls" },
      context: { function: "_createAssistantToolCall", file: "utils/mutations/assistant_tool_calls/create-assistant-tool-call.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createAssistantToolCall = createMockableAction('createAssistantToolCall', _createAssistantToolCall);
