// utils/queries/evals/get-evals-by-baseagentids.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evals } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getEvalsByBaseagentids(baseagentidIds: string[]) {
  try {
    return await db.select().from(evals).where(inArray(evals.base_agent_id, baseagentidIds));
  } catch (error) {
    console.error("Error fetching evals by baseagentids:", error);
    throw error;
  }
}
