// utils/queries/cohorts/get-cohorts-by-departments.ts
"use server";
import { db } from "@/utils/drizzle/db";
import { cohorts } from "@/utils/drizzle/schema";
import { inArray } from "drizzle-orm";
import { logError } from "@/utils/logger";

export async function getCohortsByDepartments(departmentIds: string[]) {
  try {
    return await db.select().from(cohorts).where(inArray(cohorts.departmentId, departmentIds));
  } catch (error) {
    logError("Error fetching cohorts by departments:", error);
    throw error;
  }
}
