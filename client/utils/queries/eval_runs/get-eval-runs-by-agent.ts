// utils/queries/eval_runs/get-eval-runs-by-agent.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalRunsByAgent(agentId: string) {
  try {
    return await db.select().from(evalRuns).where(eq(evalRuns.agentId, agentId));
  } catch (error) {
    console.error("Error fetching eval_runs by agent:", error);
    throw error;
  }
}
