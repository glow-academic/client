// utils/queries/eval_runs/get-all-eval-runs.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllEvalRuns() {
  try {
    return await db.select().from(evalRuns);
  } catch (error) {
    logError("Error fetching all eval_runs:", error);
    throw error;
  }
}
