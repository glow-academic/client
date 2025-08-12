// utils/queries/standard_groups/get-standard-groups-by-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { standardGroups } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getStandardGroupsByRubrics(rubricIds: string[]) {
  try {
    return await db.select().from(standardGroups).where(inArray(standardGroups.rubricId, rubricIds));
  } catch (error) {
    await log.error("query.fetch_by_fk_plural.failed", {
      message: "Error fetching standard_groups by rubrics",
      subject: { entityType: "standard_groups" },
      context: { function: "_getStandardGroupsByRubrics", file: "utils/queries/standard_groups/get-standard-groups-by-rubrics.ts", foreignKey: "rubricId", foreignIdsCount: rubricIds.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getStandardGroupsByRubrics = createMockableAction('getStandardGroupsByRubrics', _getStandardGroupsByRubrics);
