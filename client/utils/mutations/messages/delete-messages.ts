// utils/mutations/messages/delete-messages.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { messages } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteMessages(ids: string[]) {
  try {
    return await db.delete(messages).where(inArray(messages.id, ids)).returning();
  } catch (error) {
    console.error("Error deleting multiple messages:", error);
    throw error;
  }
}
