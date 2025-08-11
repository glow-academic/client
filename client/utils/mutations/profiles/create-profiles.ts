// utils/mutations/profiles/create-profiles.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { profiles } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createProfiles(data: (typeof profiles.$inferInsert)[]) {
  try {
    return await db.insert(profiles).values(data).returning();
  } catch (error) {
    logError("Error creating multiple profiles:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const createProfiles = createMockableAction('createProfiles', _createProfiles);
