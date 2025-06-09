// utils/mutations/chats/update-chat.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { chats } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function updateChat(id: string, data: Partial<typeof chats.$inferInsert>) {
  try {
    const result = await db.update(chats).set(data).where(eq(chats.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error updating chat:", error);
    throw error;
  }
}
