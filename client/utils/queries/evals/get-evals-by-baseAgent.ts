// utils/queries/evals/get-evals-by-base-agent.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evals } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalsByBaseAgent(baseAgentId: string) {
  try {
    return await db
      .select()
      .from(evals)
      .where(eq(evals.baseAgentId, baseAgentId));
  } catch (error) {
    console.error("Error fetching evals by baseAgent:", error);
    throw error;
  }
}
