// utils/queries/model_runs/get-model-runs-by-models.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getModelRunsByModels(modelIds: string[]) {
  try {
    return await db.select().from(modelRuns).where(inArray(modelRuns.modelId, modelIds));
  } catch (error) {
    logError("Error fetching model_runs by models:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getModelRunsByModels = createMockableAction('getModelRunsByModels', _getModelRunsByModels);
