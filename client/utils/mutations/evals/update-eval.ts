// utils/mutations/evals/update-eval.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evals } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateEval(id: string, data: Partial<typeof evals.$inferInsert>) {
  try {
    const result = await db.update(evals).set(data).where(eq(evals.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating eval:", error);
    throw error;
  }
}
