// utils/mutations/assistant_tool_calls/update-assistant-tool-call.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantToolCalls } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateAssistantToolCall(id: string, data: Partial<typeof assistantToolCalls.$inferInsert>) {
  try {
    const result = await db.update(assistantToolCalls).set(data).where(eq(assistantToolCalls.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.update.failed", {
      message: "Error updating assistantToolCall",
      subject: { entityType: "assistant_tool_calls", entityId: String(id) },
      context: { function: "_updateAssistantToolCall", file: "utils/mutations/assistant_tool_calls/update-assistant-tool-call.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateAssistantToolCall = createMockableAction('updateAssistantToolCall', _updateAssistantToolCall);
