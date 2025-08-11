// utils/mutations/standard_groups/update-standard-group.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { standardGroups } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateStandardGroup(id: string, data: Partial<typeof standardGroups.$inferInsert>) {
  try {
    const result = await db.update(standardGroups).set(data).where(eq(standardGroups.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating standardGroup:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateStandardGroup = createMockableAction('updateStandardGroup', _updateStandardGroup);
