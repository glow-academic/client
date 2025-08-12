// utils/mutations/model_runs/create-model-run.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _createModelRun(data: typeof modelRuns.$inferInsert) {
  try {
    const result = await db.insert(modelRuns).values(data).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.create.failed", {
      message: "Error creating modelRun",
      subject: { entityType: "model_runs" },
      context: { function: "_createModelRun", file: "utils/mutations/model_runs/create-model-run.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const createModelRun = createMockableAction('createModelRun', _createModelRun);
