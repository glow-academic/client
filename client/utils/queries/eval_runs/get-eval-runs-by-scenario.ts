// utils/queries/eval_runs/get-eval-runs-by-scenario.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalRunsByScenario(scenarioId: string) {
  try {
    return await db.select().from(evalRuns).where(eq(evalRuns.scenarioId, scenarioId));
  } catch (error) {
    console.error("Error fetching eval_runs by scenario:", error);
    throw error;
  }
}
