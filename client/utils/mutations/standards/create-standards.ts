// utils/mutations/standards/create-standards.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { standards } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createStandards(data: (typeof standards.$inferInsert)[]) {
  try {
    return await db.insert(standards).values(data).returning();
  } catch (error) {
    logError("Error creating multiple standards:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const createStandards = createMockableAction('createStandards', _createStandards);
