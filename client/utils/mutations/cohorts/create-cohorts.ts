// utils/mutations/cohorts/create-cohorts.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { cohorts } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function createCohorts(data: (typeof cohorts.$inferInsert)[]) {
  try {
    return await db.insert(cohorts).values(data).returning();
  } catch (error) {
    logError("Error creating multiple cohorts:", error);
    throw error;
  }
}
