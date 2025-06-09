// utils/queries/eval_runs/get-eval-runs-by-classid.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalRunsByClassid(classidId: string) {
  try {
    return await db.select().from(evalRuns).where(eq(evalRuns.class_id, classidId));
  } catch (error) {
    console.error("Error fetching eval_runs by classid:", error);
    throw error;
  }
}
