// utils/queries/eval_runs/get-eval-runs-by-class.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalRunsByClass(classId: string) {
  try {
    return await db.select().from(evalRuns).where(eq(evalRuns.classId, classId));
  } catch (error) {
    console.error("Error fetching eval_runs by class:", error);
    throw error;
  }
}
