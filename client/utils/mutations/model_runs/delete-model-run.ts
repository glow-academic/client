// utils/mutations/model_runs/delete-model-run.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteModelRun(id: string) {
  try {
    const result = await db.delete(modelRuns).where(eq(modelRuns.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting modelRun:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteModelRun = createMockableAction('deleteModelRun', _deleteModelRun);
