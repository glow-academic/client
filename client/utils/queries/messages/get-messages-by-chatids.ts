// utils/queries/messages/get-messages-by-chatids.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { messages } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getMessagesByChatids(chatidIds: string[]) {
  try {
    return await db.select().from(messages).where(inArray(messages.chat_id, chatidIds));
  } catch (error) {
    console.error("Error fetching messages by chatids:", error);
    throw error;
  }
}
