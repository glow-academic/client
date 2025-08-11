// utils/queries/cohorts/get-cohort.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { cohorts } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getCohort(id: string) {
  try {
    const result = await db.select().from(cohorts).where(eq(cohorts.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching cohort:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getCohort = createMockableAction('getCohort', _getCohort);
