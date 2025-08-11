// utils/mutations/parameters/delete-parameters.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameters } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteParameters(ids: string[]) {
  try {
    return await db.delete(parameters).where(inArray(parameters.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple parameters:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteParameters = createMockableAction('deleteParameters', _deleteParameters);
