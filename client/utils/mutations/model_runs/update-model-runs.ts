// utils/mutations/model_runs/update-model-runs.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateModelRuns(ids: string[], data: Partial<typeof modelRuns.$inferInsert>) {
  try {
    return await db.update(modelRuns).set(data).where(inArray(modelRuns.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple model_runs:", error);
    throw error;
  }
}
