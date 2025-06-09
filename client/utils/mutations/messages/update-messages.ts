// utils/mutations/messages/update-messages.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { messages } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateMessages(ids: string[], data: Partial<typeof messages.$inferInsert>) {
  try {
    return await db.update(messages).set(data).where(inArray(messages.id, ids)).returning();
  } catch (error) {
    console.error("Error updating multiple messages:", error);
    throw error;
  }
}
