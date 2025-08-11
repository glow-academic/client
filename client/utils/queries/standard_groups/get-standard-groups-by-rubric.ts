// utils/queries/standard_groups/get-standard-groups-by-rubric.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { standardGroups } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getStandardGroupsByRubric(rubricId: string) {
  try {
    return await db.select().from(standardGroups).where(eq(standardGroups.rubricId, rubricId));
  } catch (error) {
    logError("Error fetching standard_groups by rubric:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getStandardGroupsByRubric = createMockableAction('getStandardGroupsByRubric', _getStandardGroupsByRubric);
