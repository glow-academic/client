// utils/queries/model_runs/get-model-runs-by-models.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getModelRunsByModels(modelIds: string[]) {
  try {
    return await db.select().from(modelRuns).where(inArray(modelRuns.modelId, modelIds));
  } catch (error) {
    await log.error("query.fetch_by_fk_plural.failed", {
      message: "Error fetching model_runs by models",
      subject: { entityType: "model_runs" },
      context: { function: "_getModelRunsByModels", file: "utils/queries/model_runs/get-model-runs-by-models.ts", foreignKey: "modelId", foreignIdsCount: modelIds.length },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getModelRunsByModels = createMockableAction('getModelRunsByModels', _getModelRunsByModels);
