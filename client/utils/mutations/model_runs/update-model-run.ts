// utils/mutations/model_runs/update-model-run.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _updateModelRun(id: string, data: Partial<typeof modelRuns.$inferInsert>) {
  try {
    const result = await db.update(modelRuns).set(data).where(eq(modelRuns.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating modelRun:", error);
    throw error;
  }
}

// Export the wrapped, mockable version
export const updateModelRun = createMockableAction('updateModelRun', _updateModelRun);
