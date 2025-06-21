// utils/mutations/assistant_tool_calls/update-assistant-tool-call.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantToolCalls } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateAssistantToolCall(id: string, data: Partial<typeof assistantToolCalls.$inferInsert>) {
  try {
    const result = await db.update(assistantToolCalls).set(data).where(eq(assistantToolCalls.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating assistantToolCall:", error);
    throw error;
  }
}
