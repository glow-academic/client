// utils/queries/evals/get-evals-by-baseAgents.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evals } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getEvalsByBaseAgents(baseAgentIds: string[]) {
  try {
    return await db.select().from(evals).where(inArray(evals.baseAgentId, baseAgentIds));
  } catch (error) {
    console.error("Error fetching evals by baseAgents:", error);
    throw error;
  }
}
