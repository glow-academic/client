// utils/mutations/standard_groups/update-standard-groups.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { standardGroups } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateStandardGroups(ids: string[], data: Partial<typeof standardGroups.$inferInsert>) {
  try {
    return await db.update(standardGroups).set(data).where(inArray(standardGroups.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple standard_groups:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateStandardGroups = createMockableAction('updateStandardGroups', _updateStandardGroups);
