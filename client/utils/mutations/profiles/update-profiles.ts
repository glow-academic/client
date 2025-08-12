// utils/mutations/profiles/update-profiles.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { profiles } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateProfiles(ids: string[], data: Partial<typeof profiles.$inferInsert>) {
  try {
    return await db.update(profiles).set(data).where(inArray(profiles.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.update_many.failed", {
      message: "Error updating multiple profiles",
      subject: { entityType: "profiles" },
      context: { function: "_updateProfiles", file: "utils/mutations/profiles/update-profiles.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateProfiles = createMockableAction('updateProfiles', _updateProfiles);
