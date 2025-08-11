// utils/queries/assistant_messages/get-all-assistant-messages.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantMessages } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllAssistantMessages() {
  try {
    return await db.select().from(assistantMessages);
  } catch (error) {
    logError("Error fetching all assistant_messages:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllAssistantMessages = createMockableAction('getAllAssistantMessages', _getAllAssistantMessages);
