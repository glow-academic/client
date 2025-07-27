// utils/mutations/assistant_messages/delete-assistant-message.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantMessages } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteAssistantMessage(id: string) {
  try {
    const result = await db
      .delete(assistantMessages)
      .where(eq(assistantMessages.id, id))
      .returning();
    return result[0];
  } catch (error) {
    logError("Error deleting assistantMessage:", error);
    throw error;
  }
}
