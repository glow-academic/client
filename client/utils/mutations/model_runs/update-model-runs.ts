// utils/mutations/model_runs/update-model-runs.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateModelRuns(ids: string[], data: Partial<typeof modelRuns.$inferInsert>) {
  try {
    return await db.update(modelRuns).set(data).where(inArray(modelRuns.id, ids)).returning();
  } catch (error) {
    await log.error("mutation.update_many.failed", {
      message: "Error updating multiple model_runs",
      subject: { entityType: "model_runs" },
      context: { function: "_updateModelRuns", file: "utils/mutations/model_runs/update-model-runs.ts", count: ids.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateModelRuns = createMockableAction('updateModelRuns', _updateModelRuns);
