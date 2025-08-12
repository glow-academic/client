// utils/mutations/profiles/create-profiles.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { profiles } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createProfiles(data: (typeof profiles.$inferInsert)[]) {
  try {
    return await db.insert(profiles).values(data).returning();
  } catch (error) {
    await log.error("mutation.create_many.failed", {
      message: "Error creating multiple profiles",
      subject: { entityType: "profiles" },
      context: { function: "_createProfiles", file: "utils/mutations/profiles/create-profiles.ts", count: Array.isArray(data) ? data.length : undefined },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createProfiles = createMockableAction('createProfiles', _createProfiles);
