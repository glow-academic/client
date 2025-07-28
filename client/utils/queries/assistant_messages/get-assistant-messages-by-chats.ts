// utils/queries/assistant_messages/get-assistant-messages-by-chats.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantMessages } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getAssistantMessagesByChats(chatIds: string[]) {
  try {
    return await db.select().from(assistantMessages).where(inArray(assistantMessages.chatId, chatIds));
  } catch (error) {
    logError("Error fetching assistant_messages by chats:", error);
    throw error;
  }
}
