// utils/queries/messages/get-messages-by-chatid.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { messages } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getMessagesByChatid(chatidId: string) {
  try {
    return await db.select().from(messages).where(eq(messages.chat_id, chatidId));
  } catch (error) {
    console.error("Error fetching messages by chatid:", error);
    throw error;
  }
}
