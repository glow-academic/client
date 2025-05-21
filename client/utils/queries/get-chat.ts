// utils/queries/get-chat.ts
"use server";
import { eq } from "drizzle-orm";
import { chats } from "@/drizzle/schema";
import { db } from "@/utils/drizzle/database";

export async function getChat(chatId: string) {
  const chat = await db
    .select()
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1);
  return chat[0] || null;
}
