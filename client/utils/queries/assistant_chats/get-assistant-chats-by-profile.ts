// utils/queries/assistant_chats/get-assistant-chats-by-profile.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantChats } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAssistantChatsByProfile(profileId: string) {
  try {
    return await db.select().from(assistantChats).where(eq(assistantChats.profileId, profileId));
  } catch (error) {
    logError("Error fetching assistant_chats by profile:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAssistantChatsByProfile = createMockableAction('getAssistantChatsByProfile', _getAssistantChatsByProfile);
