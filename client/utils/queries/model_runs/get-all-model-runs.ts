// utils/queries/model_runs/get-all-model-runs.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllModelRuns() {
  try {
    return await db.select().from(modelRuns);
  } catch (error) {
    logError("Error fetching all model_runs:", error);
    throw error;
  }
}
