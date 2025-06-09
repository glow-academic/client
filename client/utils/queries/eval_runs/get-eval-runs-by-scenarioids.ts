// utils/queries/eval_runs/get-eval-runs-by-scenarioids.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getEvalRunsByScenarioids(scenarioidIds: string[]) {
  try {
    return await db.select().from(evalRuns).where(inArray(evalRuns.scenario_id, scenarioidIds));
  } catch (error) {
    console.error("Error fetching eval_runs by scenarioids:", error);
    throw error;
  }
}
