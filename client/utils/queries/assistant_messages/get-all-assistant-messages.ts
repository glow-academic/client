// utils/queries/assistant_messages/get-all-assistant-messages.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantMessages } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllAssistantMessages() {
  try {
    return await db.select().from(assistantMessages);
  } catch (error) {
    await log.error("query.fetch_all.failed", {
      message: "Error fetching all assistant_messages",
      subject: { entityType: "assistant_messages" },
      context: { function: "_getAllAssistantMessages", file: "utils/queries/assistant_messages/get-all-assistant-messages.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllAssistantMessages = createMockableAction('getAllAssistantMessages', _getAllAssistantMessages);
