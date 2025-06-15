// utils/mutations/eval_runs/create-eval-runs.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evalRuns } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createEvalRuns(data: (typeof evalRuns.$inferInsert)[]) {
  try {
    return await db.insert(evalRuns).values(data).returning();
  } catch (error) {
    logError("Error creating multiple eval_runs:", error);
    throw error;
  }
}
