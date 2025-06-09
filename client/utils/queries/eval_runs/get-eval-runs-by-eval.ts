// utils/queries/eval_runs/get-eval-runs-by-eval.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalRunsByEval(evalId: string) {
  try {
    return await db.select().from(evalRuns).where(eq(evalRuns.eval_id, evalId));
  } catch (error) {
    console.error("Error fetching eval_runs by eval:", error);
    throw error;
  }
}
