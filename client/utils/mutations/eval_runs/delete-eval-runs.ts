// utils/mutations/eval_runs/delete-eval-runs.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evalRuns } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteEvalRuns(ids: string[]) {
  try {
    return await db.delete(evalRuns).where(inArray(evalRuns.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple eval_runs:", error);
    throw error;
  }
}
