// utils/queries/evals/get-eval.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evals } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function getEval(id: string) {
  try {
    const result = await db.select().from(evals).where(eq(evals.id, id));
    return result[0] || null;
  } catch (error) {
    console.error("Error fetching eval:", error);
    throw error;
  }
}
