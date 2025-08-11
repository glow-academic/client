// utils/queries/assistant_tool_calls/get-all-assistant-tool-calls.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantToolCalls } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllAssistantToolCalls() {
  try {
    return await db.select().from(assistantToolCalls);
  } catch (error) {
    logError("Error fetching all assistant_tool_calls:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllAssistantToolCalls = createMockableAction('getAllAssistantToolCalls', _getAllAssistantToolCalls);
