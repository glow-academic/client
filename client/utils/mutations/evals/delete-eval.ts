// utils/mutations/evals/delete-eval.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evals } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function deleteEval(id: string) {
  try {
    const result = await db.delete(evals).where(eq(evals.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error deleting eval:", error);
    throw error;
  }
}
