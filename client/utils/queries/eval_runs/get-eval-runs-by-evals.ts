// utils/queries/eval_runs/get-eval-runs-by-evals.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getEvalRunsByEvals(evalIds: string[]) {
  try {
    return await db.select().from(evalRuns).where(inArray(evalRuns.eval_id, evalIds));
  } catch (error) {
    console.error("Error fetching eval_runs by evals:", error);
    throw error;
  }
}
