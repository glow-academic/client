// utils/mutations/chats/delete-chat.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { chats } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function deleteChat(id: string) {
  try {
    const result = await db.delete(chats).where(eq(chats.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error deleting chat:", error);
    throw error;
  }
}
