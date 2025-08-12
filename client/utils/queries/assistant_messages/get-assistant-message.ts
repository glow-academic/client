// utils/queries/assistant_messages/get-assistant-message.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantMessages } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAssistantMessage(id: string) {
  try {
    const result = await db.select().from(assistantMessages).where(eq(assistantMessages.id, id));
    return result[0] || null;
  } catch (error) {
    await log.error("query.fetch_one.failed", {
      message: "Error fetching assistantMessage",
      subject: { entityType: "assistant_messages", entityId: String(id) },
      context: { function: "_getAssistantMessage", file: "utils/queries/assistant_messages/get-assistant-message.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAssistantMessage = createMockableAction('getAssistantMessage', _getAssistantMessage);
