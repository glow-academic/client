// utils/queries/eval_runs/get-eval-runs-by-responseagents.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getEvalRunsByResponseagents(responseagentIds: string[]) {
  try {
    return await db.select().from(evalRuns).where(inArray(evalRuns.response_agent_id, responseagentIds));
  } catch (error) {
    console.error("Error fetching eval_runs by responseagents:", error);
    throw error;
  }
}
