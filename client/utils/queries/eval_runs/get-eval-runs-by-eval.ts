// utils/queries/eval_runs/get-eval-runs-by-eval.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getEvalRunsByEval(evalId: string) {
  try {
    return await db.select().from(evalRuns).where(eq(evalRuns.evalId, evalId));
  } catch (error) {
    logError("Error fetching eval_runs by eval:", error);
    throw error;
  }
}
