// utils/queries/assistant_messages/get-assistant-messages-by-chat.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantMessages } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getAssistantMessagesByChat(chatId: string) {
  try {
    return await db
      .select()
      .from(assistantMessages)
      .where(eq(assistantMessages.chatId, chatId));
  } catch (error) {
    logError("Error fetching assistant_messages by chat:", error);
    throw error;
  }
}
