// utils/mutations/evals/delete-evals.ts
"use server";
import { db } from "@/utils/drizzle/database";
import { evals } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";

export async function deleteEvals(ids: string[]) {
  try {
    return await db.delete(evals).where(inArray(evals.id, ids)).returning();
  } catch (error) {
    console.error("Error deleting multiple evals:", error);
    throw error;
  }
}
