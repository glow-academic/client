// utils/mutations/standard_groups/delete-standard-group.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { standardGroups } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteStandardGroup(id: string) {
  try {
    const result = await db.delete(standardGroups).where(eq(standardGroups.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.delete.failed", {
      message: "Error deleting standardGroup",
      subject: { entityType: "standard_groups", entityId: String(id) },
      context: { function: "_deleteStandardGroup", file: "utils/mutations/standard_groups/delete-standard-group.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteStandardGroup = createMockableAction('deleteStandardGroup', _deleteStandardGroup);
