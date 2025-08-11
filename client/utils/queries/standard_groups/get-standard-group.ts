// utils/queries/standard_groups/get-standard-group.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { standardGroups } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getStandardGroup(id: string) {
  try {
    const result = await db.select().from(standardGroups).where(eq(standardGroups.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching standardGroup:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getStandardGroup = createMockableAction('getStandardGroup', _getStandardGroup);
