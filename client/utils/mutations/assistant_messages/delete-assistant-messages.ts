// utils/mutations/assistant_messages/delete-assistant-messages.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantMessages } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteAssistantMessages(ids: string[]) {
  try {
    return await db
      .delete(assistantMessages)
      .where(inArray(assistantMessages.id, ids))
      .returning();
  } catch (error) {
    logError("Error deleting multiple assistant_messages:", error);
    throw error;
  }
}
