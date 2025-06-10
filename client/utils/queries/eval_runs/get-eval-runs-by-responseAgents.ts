// utils/queries/eval_runs/get-eval-runs-by-response-agents.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getEvalRunsByResponseAgents(responseAgentIds: string[]) {
  try {
    return await db.select().from(evalRuns).where(inArray(evalRuns.responseAgentId, responseAgentIds));
  } catch (error) {
    console.error("Error fetching eval_runs by responseAgents:", error);
    throw error;
  }
}
