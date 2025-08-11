// utils/mutations/cohorts/create-cohorts.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { cohorts } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createCohorts(data: (typeof cohorts.$inferInsert)[]) {
  try {
    return await db.insert(cohorts).values(data).returning();
  } catch (error) {
    logError("Error creating multiple cohorts:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const createCohorts = createMockableAction('createCohorts', _createCohorts);
