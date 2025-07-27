// utils/mutations/assistant_messages/create-assistant-messages.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantMessages } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createAssistantMessages(
  data: (typeof assistantMessages.$inferInsert)[],
) {
  try {
    return await db.insert(assistantMessages).values(data).returning();
  } catch (error) {
    logError("Error creating multiple assistant_messages:", error);
    throw error;
  }
}
