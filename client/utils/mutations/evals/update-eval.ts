// utils/mutations/evals/update-eval.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evals } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function updateEval(id: string, data: Partial<typeof evals.$inferInsert>) {
  try {
    const result = await db.update(evals).set(data).where(eq(evals.id, id)).returning();
    return result[0];
  } catch (error) {
    console.error("Error updating eval:", error);
    throw error;
  }
}
