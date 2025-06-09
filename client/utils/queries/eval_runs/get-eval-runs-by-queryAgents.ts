// utils/queries/eval_runs/get-eval-runs-by-queryagents.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getEvalRunsByQueryagents(queryagentIds: string[]) {
  try {
    return await db.select().from(evalRuns).where(inArray(evalRuns.query_agent_id, queryagentIds));
  } catch (error) {
    console.error("Error fetching eval_runs by queryagents:", error);
    throw error;
  }
}
