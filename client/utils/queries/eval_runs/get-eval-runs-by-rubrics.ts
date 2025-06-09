// utils/queries/eval_runs/get-eval-runs-by-rubrics.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getEvalRunsByRubrics(rubricIds: string[]) {
  try {
    return await db.select().from(evalRuns).where(inArray(evalRuns.rubricId, rubricIds));
  } catch (error) {
    console.error("Error fetching eval_runs by rubrics:", error);
    throw error;
  }
}
