// utils/queries/assistant_chats/get-all-assistant-chats.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantChats } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllAssistantChats() {
  try {
    return await db.select().from(assistantChats);
  } catch (error) {
    logError("Error fetching all assistant_chats:", error);
    throw error;
  }
}
