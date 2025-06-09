// utils/queries/eval_runs/get-all-eval-runs.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";

export async function getAllEvalRuns() {
  try {
    return await db.select().from(evalRuns);
  } catch (error) {
    console.error("Error fetching all eval_runs:", error);
    throw error;
  }
}
