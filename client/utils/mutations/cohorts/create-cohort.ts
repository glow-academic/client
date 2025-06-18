// utils/mutations/cohorts/create-cohort.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { cohorts } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createCohort(data: typeof cohorts.$inferInsert) {
  try {
    const result = await db.insert(cohorts).values(data).returning();
    return result[0];
  } catch (error) {
    logError("Error creating cohort:", error);
    throw error;
  }
}
