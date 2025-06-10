// utils/queries/eval_runs/get-eval-runs-by-agents.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getEvalRunsByAgents(agentIds: string[]) {
  try {
    return await db
      .select()
      .from(evalRuns)
      .where(inArray(evalRuns.agentId, agentIds));
  } catch (error) {
    console.error("Error fetching eval_runs by agents:", error);
    throw error;
  }
}
