// utils/mutations/model_runs/create-model-runs.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createModelRuns(data: (typeof modelRuns.$inferInsert)[]) {
  try {
    return await db.insert(modelRuns).values(data).returning();
  } catch (error) {
    await log.error("mutation.create_many.failed", {
      message: "Error creating multiple model_runs",
      subject: { entityType: "model_runs" },
      context: { function: "_createModelRuns", file: "utils/mutations/model_runs/create-model-runs.ts", count: Array.isArray(data) ? data.length : undefined },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createModelRuns = createMockableAction('createModelRuns', _createModelRuns);
