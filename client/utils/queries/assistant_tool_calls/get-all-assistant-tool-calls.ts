// utils/queries/assistant_tool_calls/get-all-assistant-tool-calls.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantToolCalls } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllAssistantToolCalls() {
  try {
    return await db.select().from(assistantToolCalls);
  } catch (error) {
    await log.error("query.fetch_all.failed", {
      message: "Error fetching all assistant_tool_calls",
      subject: { entityType: "assistant_tool_calls" },
      context: { function: "_getAllAssistantToolCalls", file: "utils/queries/assistant_tool_calls/get-all-assistant-tool-calls.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllAssistantToolCalls = createMockableAction('getAllAssistantToolCalls', _getAllAssistantToolCalls);
