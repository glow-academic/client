// utils/mutations/rubrics/create-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { rubrics } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createRubrics(data: (typeof rubrics.$inferInsert)[]) {
  try {
    return await db.insert(rubrics).values(data).returning();
  } catch (error) {
    logError("Error creating multiple rubrics:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const createRubrics = createMockableAction('createRubrics', _createRubrics);
