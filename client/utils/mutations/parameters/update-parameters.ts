// utils/mutations/parameters/update-parameters.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { parameters } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateParameters(ids: string[], data: Partial<typeof parameters.$inferInsert>) {
  try {
    return await db.update(parameters).set(data).where(inArray(parameters.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple parameters:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateParameters = createMockableAction('updateParameters', _updateParameters);
