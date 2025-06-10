// utils/mutations/eval_runs/delete-eval-run.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function deleteEvalRun(id: string) {
  try {
    const result = await db.delete(evalRuns).where(eq(evalRuns.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error deleting evalRun:", error);
    throw error;
  }
}
