// utils/mutations/rubrics/delete-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { rubrics } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteRubrics(ids: string[]) {
  try {
    return await db.delete(rubrics).where(inArray(rubrics.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple rubrics:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteRubrics = createMockableAction('deleteRubrics', _deleteRubrics);
