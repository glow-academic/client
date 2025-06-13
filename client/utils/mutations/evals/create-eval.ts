// utils/mutations/evals/create-eval.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evals } from "@/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createEval(data: typeof evals.$inferInsert) {
  try {
    const result = await db.insert(evals).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating eval:", error);
    throw error;
  }
}
