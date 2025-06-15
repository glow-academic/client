// utils/queries/eval_runs/get-eval-runs-by-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evalRuns } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getEvalRunsByRubrics(rubricIds: string[]) {
  try {
    return await db.select().from(evalRuns).where(inArray(evalRuns.rubricId, rubricIds));
  } catch (error) {
    logError("Error fetching eval_runs by rubrics:", error);
    throw error;
  }
}
