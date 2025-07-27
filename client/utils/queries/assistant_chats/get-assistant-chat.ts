// utils/queries/assistant_chats/get-assistant-chat.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantChats } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getAssistantChat(id: string) {
  try {
    const result = await db
      .select()
      .from(assistantChats)
      .where(eq(assistantChats.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching assistantChat:", error);
    throw error;
  }
}
