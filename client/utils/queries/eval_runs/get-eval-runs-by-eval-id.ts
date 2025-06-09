// utils/queries/eval_runs/get-eval-runs-by-evalid.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalRunsByEvalid(evalidId: string) {
  try {
    return await db.select().from(evalRuns).where(eq(evalRuns.eval_id, evalidId));
  } catch (error) {
    console.error("Error fetching eval_runs by evalid:", error);
    throw error;
  }
}
