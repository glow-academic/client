// utils/mutations/profiles/create-profile.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { profiles } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createProfile(data: typeof profiles.$inferInsert) {
  try {
    const result = await db.insert(profiles).values(data).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.create.failed", {
      message: "Error creating profile",
      subject: { entityType: "profiles" },
      context: { function: "_createProfile", file: "utils/mutations/profiles/create-profile.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createProfile = createMockableAction('createProfile', _createProfile);
