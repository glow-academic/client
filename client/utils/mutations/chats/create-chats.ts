// utils/mutations/chats/create-chats.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { chats } from "@/drizzle/schema";

export async function createChats(data: (typeof chats.$inferInsert)[]) {
  try {
    return await db.insert(chats).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple chats:", error);
    throw error;
  }
}
