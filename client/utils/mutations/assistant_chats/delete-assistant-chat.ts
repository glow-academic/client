// utils/mutations/assistant_chats/delete-assistant-chat.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantChats } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteAssistantChat(id: string) {
  try {
    const result = await db
      .delete(assistantChats)
      .where(eq(assistantChats.id, id))
      .returning();
    return result[0];
  } catch (error) {
    logError("Error deleting assistantChat:", error);
    throw error;
  }
}
