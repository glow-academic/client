// utils/queries/eval_runs/get-eval-runs-by-rubricid.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalRunsByRubricid(rubricidId: string) {
  try {
    return await db.select().from(evalRuns).where(eq(evalRuns.rubric_id, rubricidId));
  } catch (error) {
    console.error("Error fetching eval_runs by rubricid:", error);
    throw error;
  }
}
