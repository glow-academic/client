// utils/mutations/messages/delete-message.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { messages } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function deleteMessage(id: string) {
  try {
    const result = await db.delete(messages).where(eq(messages.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error deleting message:", error);
    throw error;
  }
}
