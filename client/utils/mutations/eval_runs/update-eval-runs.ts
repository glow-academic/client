// utils/mutations/eval_runs/update-eval-runs.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evalRuns } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateEvalRuns(ids: string[], data: Partial<typeof evalRuns.$inferInsert>) {
  try {
    return await db.update(evalRuns).set(data).where(inArray(evalRuns.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple eval_runs:", error);
    throw error;
  }
}
