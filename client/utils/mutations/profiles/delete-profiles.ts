// utils/mutations/profiles/delete-profiles.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { profiles } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteProfiles(ids: string[]) {
  try {
    return await db.delete(profiles).where(inArray(profiles.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.delete_many.failed", {
      message: "Error deleting multiple profiles",
      subject: { entityType: "profiles" },
      context: { function: "_deleteProfiles", file: "utils/mutations/profiles/delete-profiles.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteProfiles = createMockableAction('deleteProfiles', _deleteProfiles);
