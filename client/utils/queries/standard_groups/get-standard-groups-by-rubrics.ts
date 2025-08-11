// utils/queries/standard_groups/get-standard-groups-by-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { standardGroups } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getStandardGroupsByRubrics(rubricIds: string[]) {
  try {
    return await db.select().from(standardGroups).where(inArray(standardGroups.rubricId, rubricIds));
  } catch (error) {
    logError("Error fetching standard_groups by rubrics:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getStandardGroupsByRubrics = createMockableAction('getStandardGroupsByRubrics', _getStandardGroupsByRubrics);
