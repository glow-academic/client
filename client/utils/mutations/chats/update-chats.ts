// utils/mutations/chats/update-chats.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { chats } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateChats(ids: string[], data: Partial<typeof chats.$inferInsert>) {
  try {
    return await db.update(chats).set(data).where(inArray(chats.id, ids)).returning();
  } catch (error) {
    console.error("Error updating multiple chats:", error);
    throw error;
  }
}
