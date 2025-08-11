// utils/queries/cohorts/get-all-cohorts.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { cohorts } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllCohorts() {
  try {
    return await db.select().from(cohorts);
  } catch (error) {
    logError("Error fetching all cohorts:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllCohorts = createMockableAction('getAllCohorts', _getAllCohorts);
