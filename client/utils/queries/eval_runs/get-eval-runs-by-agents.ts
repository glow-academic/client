// utils/queries/eval_runs/get-eval-runs-by-agents.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getEvalRunsByAgents(agentIds: string[]) {
  try {
    return await db.select().from(evalRuns).where(inArray(evalRuns.agentId, agentIds));
  } catch (error) {
    logError("Error fetching eval_runs by agents:", error);
    throw error;
  }
}
