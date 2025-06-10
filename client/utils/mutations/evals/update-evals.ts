// utils/mutations/evals/update-evals.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evals } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function updateEvals(
  ids: string[],
  data: Partial<typeof evals.$inferInsert>,
) {
  try {
    return await db
      .update(evals)
      .set(data)
      .where(inArray(evals.id, ids))
      .returning();
  } catch (error) {
    console.error("Error updating multiple evals:", error);
    throw error;
  }
}
