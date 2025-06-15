// utils/queries/eval_runs/get-eval-runs-by-agent.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evalRuns } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getEvalRunsByAgent(agentId: string) {
  try {
    return await db.select().from(evalRuns).where(eq(evalRuns.agentId, agentId));
  } catch (error) {
    logError("Error fetching eval_runs by agent:", error);
    throw error;
  }
}
