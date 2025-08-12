// utils/queries/model_runs/get-model-run.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getModelRun(id: string) {
  try {
    const result = await db.select().from(modelRuns).where(eq(modelRuns.id, id));
    return result[0] || null;
  } catch (error) {
    await log.error("query.fetch_one.failed", {
      message: "Error fetching modelRun",
      subject: { entityType: "model_runs", entityId: String(id) },
      context: { function: "_getModelRun", file: "utils/queries/model_runs/get-model-run.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const getModelRun = createMockableAction('getModelRun', _getModelRun);
