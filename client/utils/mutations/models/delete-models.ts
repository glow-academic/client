// utils/mutations/models/delete-models.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { models } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteModels(ids: string[]) {
  try {
    return await db.delete(models).where(inArray(models.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple models:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteModels = createMockableAction('deleteModels', _deleteModels);
