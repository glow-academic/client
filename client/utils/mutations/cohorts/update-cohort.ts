// utils/mutations/cohorts/update-cohort.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { cohorts } from "@/utils/drizzle/schema";
import { eq } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function updateCohort(id: string, data: Partial<typeof cohorts.$inferInsert>) {
  try {
    const result = await db.update(cohorts).set(data).where(eq(cohorts.id, id)).returning();
    return result[0];
  } catch (error) {
    logError("Error updating cohort:", error);
    throw error;
  }
}
