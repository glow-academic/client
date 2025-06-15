// utils/mutations/eval_runs/update-eval-run.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evalRuns } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateEvalRun(id: string, data: Partial<typeof evalRuns.$inferInsert>) {
  try {
    const result = await db.update(evalRuns).set(data).where(eq(evalRuns.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating evalRun:", error);
    throw error;
  }
}
