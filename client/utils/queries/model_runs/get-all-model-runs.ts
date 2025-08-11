// utils/queries/model_runs/get-all-model-runs.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getAllModelRuns() {
  try {
    return await db.select().from(modelRuns);
  } catch (error) {
    logError("Error fetching all model_runs:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getAllModelRuns = createMockableAction('getAllModelRuns', _getAllModelRuns);
