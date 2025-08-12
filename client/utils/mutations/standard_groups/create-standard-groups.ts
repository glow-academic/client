// utils/mutations/standard_groups/create-standard-groups.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { standardGroups } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createStandardGroups(data: (typeof standardGroups.$inferInsert)[]) {
  try {
    return await db.insert(standardGroups).values(data).returning();
  } catch (error) {
    await log.error("mutation.create_many.failed", {
      message: "Error creating multiple standard_groups",
      subject: { entityType: "standard_groups" },
      context: { function: "_createStandardGroups", file: "utils/mutations/standard_groups/create-standard-groups.ts", count: Array.isArray(data) ? data.length : undefined },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createStandardGroups = createMockableAction('createStandardGroups', _createStandardGroups);
