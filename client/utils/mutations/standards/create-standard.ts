// utils/mutations/standards/create-standard.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { standards } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createStandard(data: typeof standards.$inferInsert) {
  try {
    const result = await db.insert(standards).values(data).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.create.failed", {
      message: "Error creating standard",
      subject: { entityType: "standards" },
      context: { function: "_createStandard", file: "utils/mutations/standards/create-standard.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createStandard = createMockableAction('createStandard', _createStandard);
