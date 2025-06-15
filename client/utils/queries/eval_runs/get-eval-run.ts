// utils/queries/eval_runs/get-eval-run.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evalRuns } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getEvalRun(id: string) {
  try {
    const result = await db.select().from(evalRuns).where(eq(evalRuns.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching evalRun:", error);
    throw error;
  }
}
