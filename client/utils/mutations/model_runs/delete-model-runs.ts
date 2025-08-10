// utils/mutations/model_runs/delete-model-runs.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteModelRuns(ids: string[]) {
  try {
    return await db.delete(modelRuns).where(inArray(modelRuns.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple model_runs:", error);
    throw error;
  }
}
