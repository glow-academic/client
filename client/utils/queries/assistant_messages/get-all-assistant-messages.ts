// utils/queries/assistant_messages/get-all-assistant-messages.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantMessages } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllAssistantMessages() {
  try {
    return await db.select().from(assistantMessages);
  } catch (error) {
    logError("Error fetching all assistant_messages:", error);
    throw error;
  }
}
