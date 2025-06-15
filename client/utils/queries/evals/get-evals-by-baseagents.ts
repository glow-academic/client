// utils/queries/evals/get-evals-by-base-agents.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evals } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getEvalsByBaseAgents(baseAgentIds: string[]) {
  try {
    return await db.select().from(evals).where(inArray(evals.baseAgentId, baseAgentIds));
  } catch (error) {
    logError("Error fetching evals by baseAgents:", error);
    throw error;
  }
}
