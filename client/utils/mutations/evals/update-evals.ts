// utils/mutations/evals/update-evals.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evals } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateEvals(ids: string[], data: Partial<typeof evals.$inferInsert>) {
  try {
    return await db.update(evals).set(data).where(inArray(evals.id, ids)).returning();
  } catch (error) {
    logError("Error updating multiple evals:", error);
    throw error;
  }
}
