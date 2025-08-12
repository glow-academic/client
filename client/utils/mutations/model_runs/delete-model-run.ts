// utils/mutations/model_runs/delete-model-run.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { log } from "@/utils/logger";
import { createMockableAction } from "@/lib/testing/create-mockable-action";

// Original logic is now a "private" function
async function _deleteModelRun(id: string) {
  try {
    const result = await db.delete(modelRuns).where(eq(modelRuns.id, id)).returning();
    return result[0];
  } catch (error) {
    await log.error("mutation.delete.failed", {
      message: "Error deleting modelRun",
      subject: { entityType: "model_runs", entityId: String(id) },
      context: { function: "_deleteModelRun", file: "utils/mutations/model_runs/delete-model-run.ts" },
      error,
    });
    throw error;
  }
}

// Export the wrapped, mockable version
export const deleteModelRun = createMockableAction('deleteModelRun', _deleteModelRun);
