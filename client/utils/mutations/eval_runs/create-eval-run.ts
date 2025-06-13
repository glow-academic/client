// utils/mutations/eval_runs/create-eval-run.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createEvalRun(data: typeof evalRuns.$inferInsert) {
  try {
    const result = await db.insert(evalRuns).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating evalRun:", error);
    throw error;
  }
}
