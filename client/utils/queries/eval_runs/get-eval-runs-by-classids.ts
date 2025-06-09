// utils/queries/eval_runs/get-eval-runs-by-classids.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function getEvalRunsByClassids(classidIds: string[]) {
  try {
    return await db.select().from(evalRuns).where(inArray(evalRuns.class_id, classidIds));
  } catch (error) {
    console.error("Error fetching eval_runs by classids:", error);
    throw error;
  }
}
