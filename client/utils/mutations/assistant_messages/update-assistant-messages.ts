// utils/mutations/assistant_messages/update-assistant-messages.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantMessages } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateAssistantMessages(ids: string[], data: Partial<typeof assistantMessages.$inferInsert>) {
  try {
    return await db.update(assistantMessages).set(data).where(inArray(assistantMessages.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple assistant_messages:", error);
    throw error;
  }
}
