// utils/mutations/standard_groups/create-standard-group.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { standardGroups } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createStandardGroup(data: typeof standardGroups.$inferInsert) {
  try {
    const result = await db.insert(standardGroups).values(data).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.create.failed", {
      message: "Error creating standardGroup",
      subject: { entityType: "standard_groups" },
      context: { function: "_createStandardGroup", file: "utils/mutations/standard_groups/create-standard-group.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createStandardGroup = createMockableAction('createStandardGroup', _createStandardGroup);
