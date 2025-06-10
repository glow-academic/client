// utils/mutations/eval_runs/delete-eval-runs.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteEvalRuns(ids: string[]) {
  try {
    return await db
      .delete(evalRuns)
      .where(inArray(evalRuns.id, ids))
      .returning();
  } catch (error) {
    console.error("Error deleting multiple eval_runs:", error);
    throw error;
  }
}
