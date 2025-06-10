// utils/mutations/eval_runs/create-eval-runs.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";

export async function createEvalRuns(data: (typeof evalRuns.$inferInsert)[]) {
  try {
    return await db.insert(evalRuns).values(data).returning();
  } catch (error) {
    console.error("Error creating multiple eval_runs:", error);
    throw error;
  }
}
