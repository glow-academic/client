// utils/mutations/model_runs/delete-model-runs.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteModelRuns(ids: string[]) {
  try {
    return await db.delete(modelRuns).where(inArray(modelRuns.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple model_runs:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteModelRuns = createMockableAction('deleteModelRuns', _deleteModelRuns);
