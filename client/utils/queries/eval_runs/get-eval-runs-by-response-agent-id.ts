// utils/queries/eval_runs/get-eval-runs-by-responseagentid.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalRunsByResponseagentid(responseagentidId: string) {
  try {
    return await db.select().from(evalRuns).where(eq(evalRuns.response_agent_id, responseagentidId));
  } catch (error) {
    console.error("Error fetching eval_runs by responseagentid:", error);
    throw error;
  }
}
