// utils/queries/eval_runs/get-eval-runs-by-queryagentid.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalRunsByQueryagentid(queryagentidId: string) {
  try {
    return await db.select().from(evalRuns).where(eq(evalRuns.query_agent_id, queryagentidId));
  } catch (error) {
    console.error("Error fetching eval_runs by queryagentid:", error);
    throw error;
  }
}
