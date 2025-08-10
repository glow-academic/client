// utils/queries/model_runs/get-model-run.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getModelRun(id: string) {
  try {
    const result = await db.select().from(modelRuns).where(eq(modelRuns.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching modelRun:", error);
    throw error;
  }
}
