// utils/mutations/messages/create-messages.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { messages } from "@/drizzle/schema";

export async function createMessages(data: (typeof messages.$inferInsert)[]) {
  try {
    return await db.insert(messages).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple messages:", error);
    throw error;
  }
}
