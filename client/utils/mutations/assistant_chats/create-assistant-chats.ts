// utils/mutations/assistant_chats/create-assistant-chats.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantChats } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createAssistantChats(
  data: (typeof assistantChats.$inferInsert)[],
) {
  try {
    return await db.insert(assistantChats).values(data).returning();
  } catch (error) {
    logError("Error creating multiple assistant_chats:", error);
    throw error;
  }
}
