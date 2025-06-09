// utils/queries/eval_runs/get-eval-runs-by-rubric.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalRunsByRubric(rubricId: string) {
  try {
    return await db.select().from(evalRuns).where(eq(evalRuns.rubricId, rubricId));
  } catch (error) {
    console.error("Error fetching eval_runs by rubric:", error);
    throw error;
  }
}
