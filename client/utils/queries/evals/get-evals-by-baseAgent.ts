// utils/queries/evals/get-evals-by-baseagent.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evals } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalsByBaseagent(baseagentId: string) {
  try {
    return await db.select().from(evals).where(eq(evals.base_agent_id, baseagentId));
  } catch (error) {
    console.error("Error fetching evals by baseagent:", error);
    throw error;
  }
}
