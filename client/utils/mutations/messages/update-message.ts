// utils/mutations/messages/update-message.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { messages } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function updateMessage(id: string, data: Partial<typeof messages.$inferInsert>) {
  try {
    const result = await db.update(messages).set(data).where(eq(messages.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error updating message:", error);
    throw error;
  }
}
