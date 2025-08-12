// utils/queries/standards/get-standards-by-standard-groups.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { standards } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getStandardsByStandardGroups(standardGroupIds: string[]) {
  try {
    return await db.select().from(standards).where(inArray(standards.standardGroupId, standardGroupIds));
  } catch (error) {
    await log.error("query.fetch_by_fk_plural.failed", {
      message: "Error fetching standards by standardGroups",
      subject: { entityType: "standards" },
      context: { function: "_getStandardsByStandardGroups", file: "utils/queries/standards/get-standards-by-standard-groups.ts", foreignKey: "standardGroupId", foreignIdsCount: standardGroupIds.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getStandardsByStandardGroups = createMockableAction('getStandardsByStandardGroups', _getStandardsByStandardGroups);
