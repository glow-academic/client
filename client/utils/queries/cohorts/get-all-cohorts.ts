// utils/queries/cohorts/get-all-cohorts.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { cohorts } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";

export async function getAllCohorts() {
  try {
    return await db.select().from(cohorts);
  } catch (error) {
    logError("Error fetching all cohorts:", error);
    throw error;
  }
}
