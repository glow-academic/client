// utils/queries/get-messages.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { eq } from "drizzle-orm";
import { messages } from "@/drizzle/schema";

export async function getMessages(chatId: string) {
  const chatMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId));
  return chatMessages;
}
