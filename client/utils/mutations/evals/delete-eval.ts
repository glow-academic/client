// utils/mutations/evals/delete-eval.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evals } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteEval(id: string) {
  try {
    const result = await db.delete(evals).where(eq(evals.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting eval:", error);
    throw error;
  }
}
