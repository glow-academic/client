// utils/mutations/profiles/create-profile.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { profiles } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createProfile(data: typeof profiles.$inferInsert) {
  try {
    const result = await db.insert(profiles).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating profile:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const createProfile = createMockableAction('createProfile', _createProfile);
