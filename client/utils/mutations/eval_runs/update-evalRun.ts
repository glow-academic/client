// utils/mutations/eval_runs/update-evalRun.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function updateEvalRun(
  id: string,
  data: Partial<typeof evalRuns.$inferInsert>,
) {
  try {
    const result = await db
      .update(evalRuns)
      .set(data)
      .where(eq(evalRuns.id, id))
      .returning();
    return result[0];
  } catch (error) {
    console.error("Error updating evalRun:", error);
    throw error;
  }
}
