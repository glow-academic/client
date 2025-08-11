// utils/queries/model_runs/get-model-run.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _getModelRun(id: string) {
  try {
    const result = await db.select().from(modelRuns).where(eq(modelRuns.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching modelRun:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const getModelRun = createMockableAction('getModelRun', _getModelRun);
