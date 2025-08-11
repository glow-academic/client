// utils/queries/standards/get-standards-by-standard-groups.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { standards } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getStandardsByStandardGroups(standardGroupIds: string[]) {
  try {
    return await db.select().from(standards).where(inArray(standards.standardGroupId, standardGroupIds));
  } catch (error) {
    logError("Error fetching standards by standardGroups:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getStandardsByStandardGroups = createMockableAction('getStandardsByStandardGroups', _getStandardsByStandardGroups);
