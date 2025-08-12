// utils/queries/model_runs/get-model-runs-by-model.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getModelRunsByModel(modelId: string) {
  try {
    return await db.select().from(modelRuns).where(eq(modelRuns.modelId, modelId));
  } catch (error) {
    await log.error("query.fetch_by_fk.failed", {
      message: "Error fetching model_runs by model",
      subject: { entityType: "model_runs" },
      context: { function: "_getModelRunsByModel", file: "utils/queries/model_runs/get-model-runs-by-model.ts", foreignKey: "modelId", foreignId: String(modelId) },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getModelRunsByModel = createMockableAction('getModelRunsByModel', _getModelRunsByModel);
