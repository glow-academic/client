// utils/mutations/eval_runs/update-eval-runs.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateEvalRuns(ids: string[], data: Partial<typeof evalRuns.$inferInsert>) {
  try {
    return await db.update(evalRuns).set(data).where(inArray(evalRuns.id, ids)).returning();
  } catch (error) {
    console.error("Error updating multiple eval_runs:", error);
    throw error;
  }
}
