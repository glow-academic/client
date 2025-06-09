// utils/queries/chats/get-chat.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { chats } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getChat(id: string) {
  try {
    const result = await db.select().from(chats).where(eq(chats.id, id));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching chat:", error);
    throw error;
  }
}
