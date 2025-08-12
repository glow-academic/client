// utils/mutations/standards/create-standards.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { standards } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createStandards(data: (typeof standards.$inferInsert)[]) {
  try {
    return await db.insert(standards).values(data).returning();
  } catch (error) {
    await log.error("mutation.create_many.failed", {
      message: "Error creating multiple standards",
      subject: { entityType: "standards" },
      context: { function: "_createStandards", file: "utils/mutations/standards/create-standards.ts", count: Array.isArray(data) ? data.length : undefined },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createStandards = createMockableAction('createStandards', _createStandards);
