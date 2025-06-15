// utils/mutations/eval_runs/delete-eval-run.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evalRuns } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteEvalRun(id: string) {
  try {
    const result = await db.delete(evalRuns).where(eq(evalRuns.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting evalRun:", error);
    throw error;
  }
}
