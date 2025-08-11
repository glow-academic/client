// utils/mutations/cohorts/update-cohorts.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { cohorts } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateCohorts(ids: string[], data: Partial<typeof cohorts.$inferInsert>) {
  try {
    return await db.update(cohorts).set(data).where(inArray(cohorts.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple cohorts:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateCohorts = createMockableAction('updateCohorts', _updateCohorts);
