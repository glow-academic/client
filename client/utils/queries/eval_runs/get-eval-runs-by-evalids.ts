// utils/queries/eval_runs/get-eval-runs-by-evalids.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getEvalRunsByEvalids(evalidIds: string[]) {
  try {
    return await db.select().from(evalRuns).where(inArray(evalRuns.eval_id, evalidIds));
  } catch (error) {
    console.error("Error fetching eval_runs by evalids:", error);
    throw error;
  }
}
