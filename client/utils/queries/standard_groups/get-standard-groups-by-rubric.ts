// utils/queries/standard_groups/get-standard-groups-by-rubric.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { standardGroups } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getStandardGroupsByRubric(rubricId: string) {
  try {
    return await db.select().from(standardGroups).where(eq(standardGroups.rubricId, rubricId));
  } catch (error) {
    await log.error("query.fetch_by_fk.failed", {
      message: "Error fetching standard_groups by rubric",
      subject: { entityType: "standard_groups" },
      context: { function: "_getStandardGroupsByRubric", file: "utils/queries/standard_groups/get-standard-groups-by-rubric.ts", foreignKey: "rubricId", foreignId: String(rubricId) },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getStandardGroupsByRubric = createMockableAction('getStandardGroupsByRubric', _getStandardGroupsByRubric);
