// utils/mutations/model_runs/delete-model-runs.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteModelRuns(ids: string[]) {
  try {
    return await db.delete(modelRuns).where(inArray(modelRuns.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.delete_many.failed", {
      message: "Error deleting multiple model_runs",
      subject: { entityType: "model_runs" },
      context: { function: "_deleteModelRuns", file: "utils/mutations/model_runs/delete-model-runs.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteModelRuns = createMockableAction('deleteModelRuns', _deleteModelRuns);
