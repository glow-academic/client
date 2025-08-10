// utils/mutations/model_runs/create-model-run.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createModelRun(data: typeof modelRuns.$inferInsert) {
  try {
    const result = await db.insert(modelRuns).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating modelRun:", error);
    throw error;
  }
}
