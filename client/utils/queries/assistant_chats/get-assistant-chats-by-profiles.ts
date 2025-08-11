// utils/queries/assistant_chats/get-assistant-chats-by-profiles.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { assistantChats } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAssistantChatsByProfiles(profileIds: string[]) {
  try {
    return await db.select().from(assistantChats).where(inArray(assistantChats.profileId, profileIds));
  } catch (error) {
    logError("Error fetching assistant_chats by profiles:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAssistantChatsByProfiles = createMockableAction('getAssistantChatsByProfiles', _getAssistantChatsByProfiles);
