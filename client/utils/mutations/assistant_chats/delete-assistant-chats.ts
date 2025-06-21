// utils/mutations/assistant_chats/delete-assistant-chats.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantChats } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteAssistantChats(ids: string[]) {
  try {
    return await db.delete(assistantChats).where(inArray(assistantChats.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple assistant_chats:", error);
    throw error;
  }
}
