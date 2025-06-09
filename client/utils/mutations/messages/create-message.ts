// utils/mutations/messages/create-message.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { messages } from "@/drizzle/schema";

export async function createMessage(data: typeof messages.$inferInsert) {
  try {
    const result = await db.insert(messages).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating message:", error);
    throw error;
  }
}
