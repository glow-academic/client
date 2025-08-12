// utils/queries/model_runs/get-all-model-runs.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllModelRuns() {
  try {
    return await db.select().from(modelRuns);
  } catch (error) {
    await log.error("query.fetch_all.failed", {
      message: "Error fetching all model_runs",
      subject: { entityType: "model_runs" },
      context: { function: "_getAllModelRuns", file: "utils/queries/model_runs/get-all-model-runs.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllModelRuns = createMockableAction('getAllModelRuns', _getAllModelRuns);
