// utils/queries/assistant_tool_calls/get-assistant-tool-call.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantToolCalls } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getAssistantToolCall(id: string) {
  try {
    const result = await db
      .select()
      .from(assistantToolCalls)
      .where(eq(assistantToolCalls.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching assistantToolCall:", error);
    throw error;
  }
}
