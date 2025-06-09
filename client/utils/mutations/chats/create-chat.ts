// utils/mutations/chats/create-chat.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { chats } from "@/drizzle/schema";

export async function createChat(data: typeof chats.$inferInsert) {
  try {
    const result = await db.insert(chats).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating chat:", error);
    throw error;
  }
}
