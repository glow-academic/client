// utils/queries/assistant_chats/get-assistant-chats-by-profile.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantChats } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getAssistantChatsByProfile(profileId: string) {
  try {
    return await db.select().from(assistantChats).where(eq(assistantChats.profileId, profileId));
  } catch (error) {
    logError("Error fetching assistant_chats by profile:", error);
    throw error;
  }
}
