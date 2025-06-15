// utils/queries/eval_runs/get-eval-runs-by-rubric.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evalRuns } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getEvalRunsByRubric(rubricId: string) {
  try {
    return await db.select().from(evalRuns).where(eq(evalRuns.rubricId, rubricId));
  } catch (error) {
    logError("Error fetching eval_runs by rubric:", error);
    throw error;
  }
}
