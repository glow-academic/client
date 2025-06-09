// utils/queries/evals/get-evals-by-baseagentid.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evals } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalsByBaseagentid(baseagentidId: string) {
  try {
    return await db.select().from(evals).where(eq(evals.base_agent_id, baseagentidId));
  } catch (error) {
    console.error("Error fetching evals by baseagentid:", error);
    throw error;
  }
}
