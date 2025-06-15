// utils/queries/evals/get-eval.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evals } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getEval(id: string) {
  try {
    const result = await db.select().from(evals).where(eq(evals.id, id));
    return result[0] || null;
  } catch (error) {
    logError("Error fetching eval:", error);
    throw error;
  }
}
