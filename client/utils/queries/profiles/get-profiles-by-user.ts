// utils/queries/profiles/get-profiles-by-user.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { profiles } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getProfilesByUser(userId: number) {
  try {
    return await db.select().from(profiles).where(eq(profiles.userId, userId));
  } catch (error) {
    logError("Error fetching profiles by user:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getProfilesByUser = createMockableAction('getProfilesByUser', _getProfilesByUser);
