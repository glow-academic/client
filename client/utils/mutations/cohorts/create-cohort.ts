// utils/mutations/cohorts/create-cohort.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { cohorts } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createCohort(data: typeof cohorts.$inferInsert) {
  try {
    const result = await db.insert(cohorts).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating cohort:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const createCohort = createMockableAction('createCohort', _createCohort);
