// utils/queries/eval_runs/get-eval-runs-by-responseagentids.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getEvalRunsByResponseagentids(responseagentidIds: string[]) {
  try {
    return await db.select().from(evalRuns).where(inArray(evalRuns.response_agent_id, responseagentidIds));
  } catch (error) {
    console.error("Error fetching eval_runs by responseagentids:", error);
    throw error;
  }
}
