// utils/queries/eval_runs/get-eval-runs-by-rubricids.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getEvalRunsByRubricids(rubricidIds: string[]) {
  try {
    return await db.select().from(evalRuns).where(inArray(evalRuns.rubric_id, rubricidIds));
  } catch (error) {
    console.error("Error fetching eval_runs by rubricids:", error);
    throw error;
  }
}
