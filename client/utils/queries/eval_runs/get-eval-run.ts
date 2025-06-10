// utils/queries/eval_runs/get-eval-run.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEvalRun(id: string) {
  try {
    const result = await db.select().from(evalRuns).where(eq(evalRuns.id, id));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching evalRun:", error);
    throw error;
  }
}
