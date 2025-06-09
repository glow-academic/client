// utils/queries/messages/get-message.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { messages } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getMessage(id: string) {
  try {
    const result = await db.select().from(messages).where(eq(messages.id, id));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching message:", error);
    throw error;
  }
}
