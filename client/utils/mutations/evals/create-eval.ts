// utils/mutations/evals/create-eval.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evals } from "@/drizzle/schema";

export async function createEval(data: typeof evals.$inferInsert) {
  try {
    const result = await db.insert(evals).values(data).returning();
    return result[0];
  } catch (error) {
    console.error("Error creating eval:", error);
    throw error;
  }
}
