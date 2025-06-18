// utils/mutations/cohorts/delete-cohort.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { cohorts } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function deleteCohort(id: string) {
  try {
    const result = await db.delete(cohorts).where(eq(cohorts.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error deleting cohort:", error);
    throw error;
  }
}
