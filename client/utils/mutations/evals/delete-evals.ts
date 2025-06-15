// utils/mutations/evals/delete-evals.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { evals } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteEvals(ids: string[]) {
  try {
    return await db.delete(evals).where(inArray(evals.id, ids)).returning();
  } catch (error) {
    logError("Error deleting multiple evals:", error);
    throw error;
  }
}
