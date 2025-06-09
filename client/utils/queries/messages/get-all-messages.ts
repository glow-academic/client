// utils/queries/messages/get-all-messages.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { messages } from "@/drizzle/schema";

export async function getAllMessages() {
  try {
    return await db.select().from(messages);
  } catch (error) {
    console.error("Error fetching all messages:", error);
    throw error;
  }
}
