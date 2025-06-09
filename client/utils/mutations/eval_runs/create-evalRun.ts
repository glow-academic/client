// utils/mutations/eval_runs/create-evalRun.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evalRuns } from "@/drizzle/schema";

export async function createEvalRun(data: typeof evalRuns.$inferInsert) {
  try {
    const result = await db.insert(evalRuns).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating evalRun:", error);
    throw error;
  }
}
