// utils/queries/eval_runs/get-eval-runs-by-queryagent.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalRunsByQueryagent(queryagentId: string) {
  try {
    return await db.select().from(evalRuns).where(eq(evalRuns.query_agent_id, queryagentId));
  } catch (error) {
    console.error("Error fetching eval_runs by queryagent:", error);
    throw error;
  }
}
