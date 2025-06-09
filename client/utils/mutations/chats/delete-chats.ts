// utils/mutations/chats/delete-chats.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { chats } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteChats(ids: string[]) {
  try {
    return await db.delete(chats).where(inArray(chats.id, ids)).returning();
  } catch (error) {
    console.error("Error deleting multiple chats:", error);
    throw error;
  }
}
