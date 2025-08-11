// utils/mutations/standard_groups/create-standard-groups.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { standardGroups } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createStandardGroups(data: (typeof standardGroups.$inferInsert)[]) {
  try {
    return await db.insert(standardGroups).values(data).returning();
  } catch (error) {
    logError("Error creating multiple standard_groups:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const createStandardGroups = createMockableAction('createStandardGroups', _createStandardGroups);
