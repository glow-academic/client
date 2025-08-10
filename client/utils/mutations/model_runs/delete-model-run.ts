// utils/mutations/model_runs/delete-model-run.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { modelRuns } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteModelRun(id: string) {
  try {
    const result = await db.delete(modelRuns).where(eq(modelRuns.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting modelRun:", error);
    throw error;
  }
}
