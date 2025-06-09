// utils/queries/evals/get-evals-by-baseagents.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evals } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getEvalsByBaseagents(baseagentIds: string[]) {
  try {
    return await db.select().from(evals).where(inArray(evals.base_agent_id, baseagentIds));
  } catch (error) {
    console.error("Error fetching evals by baseagents:", error);
    throw error;
  }
}
