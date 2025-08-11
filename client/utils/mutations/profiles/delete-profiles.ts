// utils/mutations/profiles/delete-profiles.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { profiles } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteProfiles(ids: string[]) {
  try {
    return await db.delete(profiles).where(inArray(profiles.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple profiles:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteProfiles = createMockableAction('deleteProfiles', _deleteProfiles);
