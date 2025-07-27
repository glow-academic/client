// utils/mutations/assistant_chats/update-assistant-chat.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantChats } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateAssistantChat(
  id: string,
  data: Partial<typeof assistantChats.$inferInsert>,
) {
  try {
    const result = await db
      .update(assistantChats)
      .set(data)
      .where(eq(assistantChats.id, id))
      .returning();
    return result[0];
  } catch (error) {
    logError("Error updating assistantChat:", error);
    throw error;
  }
}
