// utils/mutations/standard_groups/delete-standard-groups.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { standardGroups } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteStandardGroups(ids: string[]) {
  try {
    return await db.delete(standardGroups).where(inArray(standardGroups.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.delete_many.failed", {
      message: "Error deleting multiple standard_groups",
      subject: { entityType: "standard_groups" },
      context: { function: "_deleteStandardGroups", file: "utils/mutations/standard_groups/delete-standard-groups.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteStandardGroups = createMockableAction('deleteStandardGroups', _deleteStandardGroups);
