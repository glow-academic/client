// utils/queries/eval_runs/get-all-eval-runs.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evalRuns } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllEvalRuns() {
  try {
    return await db.select().from(evalRuns);
  } catch (error) {
    logError("Error fetching all eval_runs:", error);
    throw error;
  }
}
