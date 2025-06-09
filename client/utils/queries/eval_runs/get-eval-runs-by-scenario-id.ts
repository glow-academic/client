// utils/queries/eval_runs/get-eval-runs-by-scenarioid.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalRunsByScenarioid(scenarioidId: string) {
  try {
    return await db.select().from(evalRuns).where(eq(evalRuns.scenario_id, scenarioidId));
  } catch (error) {
    console.error("Error fetching eval_runs by scenarioid:", error);
    throw error;
  }
}
