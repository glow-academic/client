// utils/queries/evals/get-evals-by-base-agent.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evals } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getEvalsByBaseAgent(baseAgentId: string) {
  try {
    return await db.select().from(evals).where(eq(evals.baseAgentId, baseAgentId));
  } catch (error) {
    logError("Error fetching evals by baseAgent:", error);
    throw error;
  }
}
