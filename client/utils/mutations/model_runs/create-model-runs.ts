// utils/mutations/model_runs/create-model-runs.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createModelRuns(data: (typeof modelRuns.$inferInsert)[]) {
  try {
    return await db.insert(modelRuns).values(data).returning();
  } catch (error) {
    logError("Error creating multiple model_runs:", error);
    throw error;
  }
}
